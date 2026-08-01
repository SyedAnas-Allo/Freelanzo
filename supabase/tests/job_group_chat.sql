-- Job group chat lifecycle + auth helper checks.
-- Run: npx supabase db query --local -f supabase/tests/job_group_chat.sql

begin;

create or replace function pg_temp.set_auth(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_worker uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_business uuid;
  v_job uuid;
  v_app uuid;
  v_chat uuid;
  v_msg timestamptz;
  v_msg_after timestamptz;
  v_can boolean;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'chat-owner-' || v_owner::text || '@test.local', crypt('pass', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (v_worker, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'chat-worker-' || v_worker::text || '@test.local', crypt('pass', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (v_outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'chat-out-' || v_outsider::text || '@test.local', crypt('pass', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

  update public.profiles
  set full_name = 'Owner', active_mode = 'business', onboarding_complete = true
  where id = v_owner;
  update public.profiles
  set full_name = 'Worker', active_mode = 'freelancer', onboarding_complete = true
  where id = v_worker;
  update public.profiles
  set full_name = 'Outsider', active_mode = 'freelancer', onboarding_complete = true
  where id = v_outsider;

  insert into public.business_profiles (owner_id, business_name)
  values (v_owner, 'Chat Biz')
  returning id into v_business;

  insert into public.jobs (
    business_id, title, category, skilled, headcount, job_date, work_dates,
    start_time, end_time, address, city, lat, lng, pay_per_freelancer, status
  ) values (
    v_business, 'Chat Job', 'hospitality', false, 2, (current_date + 7),
    array[current_date + 7], '09:00', '17:00', '1 Main', 'Bengaluru', 12.97, 77.59, 500, 'live'
  ) returning id into v_job;

  insert into public.applications (job_id, freelancer_id, status)
  values (v_job, v_worker, 'applied')
  returning id into v_app;

  if exists (select 1 from public.job_chats where job_id = v_job) then
    raise exception 'chat should not exist before accept';
  end if;

  update public.applications set status = 'accepted' where id = v_app;

  select id into v_chat from public.job_chats where job_id = v_job;
  if v_chat is null then
    raise exception 'chat missing after accept';
  end if;

  if not exists (
    select 1 from public.job_chat_memberships
    where chat_id = v_chat and user_id = v_worker and left_at is null
  ) then
    raise exception 'worker membership missing';
  end if;

  if not exists (
    select 1 from public.job_chat_memberships
    where chat_id = v_chat and user_id = v_owner and left_at is null
  ) then
    raise exception 'owner membership missing';
  end if;

  perform pg_temp.set_auth(v_owner);
  if not public.can_send_job_message(v_chat) then
    raise exception 'owner should send after accept';
  end if;

  insert into public.job_messages (chat_id, sender_id, body)
  values (v_chat, v_owner, 'Welcome')
  returning created_at into v_msg;

  perform pg_temp.set_auth(v_outsider);
  if public.can_send_job_message(v_chat) then
    raise exception 'outsider must not send';
  end if;
  if public.is_job_chat_member(v_chat) then
    raise exception 'outsider must not be member';
  end if;

  -- Reject accepted worker
  update public.applications set status = 'rejected' where id = v_app;

  if exists (
    select 1 from public.job_chat_memberships
    where chat_id = v_chat and user_id = v_worker and left_at is null
  ) then
    raise exception 'rejected worker should leave chat';
  end if;

  -- Ensure message lands after left_at (half-open membership window).
  perform pg_sleep(0.05);
  insert into public.job_messages (chat_id, sender_id, body, created_at)
  values (v_chat, v_owner, 'After remove', clock_timestamp())
  returning created_at into v_msg_after;

  perform pg_temp.set_auth(v_worker);
  if not public.can_read_job_message(v_chat, v_msg) then
    raise exception 'worker should read history from membership window';
  end if;
  if public.can_read_job_message(v_chat, v_msg_after) then
    raise exception 'worker should not read messages after leaving';
  end if;
  if public.can_send_job_message(v_chat) then
    raise exception 'rejected worker must not send';
  end if;

  -- Re-accept
  update public.applications set status = 'accepted' where id = v_app;
  perform pg_temp.set_auth(v_worker);
  if not public.can_send_job_message(v_chat) then
    raise exception 're-accepted worker should send';
  end if;

  -- Confirm payment closes chat
  insert into public.payments (
    application_id, amount, business_claimed, freelancer_claimed, status
  ) values (v_app, 500, 'paid', 'received', 'confirmed');

  if (select closed_at from public.job_chats where id = v_chat) is null then
    raise exception 'chat should close after all payments confirmed';
  end if;
  if (select closed_reason from public.job_chats where id = v_chat)
       <> 'payments_confirmed' then
    raise exception 'expected payments_confirmed close reason';
  end if;

  perform pg_temp.set_auth(v_worker);
  if public.can_send_job_message(v_chat) then
    raise exception 'cannot send after payment close';
  end if;
  if not public.can_read_job_message(v_chat, v_msg) then
    raise exception 'history should remain readable after close';
  end if;

  -- Job cancel closes (fresh chat path)
  update public.job_chats
    set closed_at = null, closed_reason = null
    where id = v_chat;
  update public.jobs set status = 'cancelled' where id = v_job;
  if (select closed_reason from public.job_chats where id = v_chat)
       <> 'job_cancelled' then
    raise exception 'expected job_cancelled close reason';
  end if;

  raise notice 'job_group_chat checks passed';
end;
$$;

rollback;
