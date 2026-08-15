alter type public.attendance_source add value if not exists 'business_confirmation';

create table public.attendance_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind public.attendance_kind not null,
  work_date date not null,
  photo_path text not null check (length(trim(photo_path)) > 0),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'expired', 'cancelled')),
  rejection_reason text,
  requested_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null default (now() + interval '2 hours'),
  reviewed_at timestamp with time zone,
  reviewed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamp with time zone not null default now(),
  constraint attendance_requests_review_shape check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or
    (status in ('confirmed', 'rejected') and reviewed_at is not null and reviewed_by is not null)
    or
    (status in ('expired', 'cancelled'))
  ),
  constraint attendance_requests_rejection_reason check (
    status <> 'rejected'
    or length(trim(coalesce(rejection_reason, ''))) >= 2
  )
);

create unique index attendance_requests_one_pending_idx
  on public.attendance_requests (application_id, kind, work_date)
  where status = 'pending';

create index attendance_requests_application_day_idx
  on public.attendance_requests (application_id, work_date, kind, requested_at desc);

create index attendance_requests_pending_idx
  on public.attendance_requests (status, work_date, requested_at)
  where status = 'pending';

alter table public.attendance_requests enable row level security;

create policy "attendance_requests_select_parties"
  on public.attendance_requests
  for select
  to authenticated
  using (
    application_id in (
      select a.id
      from public.applications a
      where a.freelancer_id = (select auth.uid())
        or public.is_job_business_owner(a.job_id)
    )
  );

grant select on table public.attendance_requests to authenticated;
grant all on table public.attendance_requests to service_role;

alter publication supabase_realtime add table public.attendance_requests;

create or replace function public.submit_attendance_request(
  p_application_id uuid,
  p_kind public.attendance_kind,
  p_photo_path text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_work_date date default null
) returns public.attendance_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_request public.attendance_requests;
  v_owner uuid;
  v_name text;
  v_date date;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'A live attendance photo is required';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'Invalid latitude';
  end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'Invalid longitude';
  end if;

  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if v_app is null then
    raise exception 'Application not found';
  end if;
  if v_app.freelancer_id <> auth.uid() then
    raise exception 'Not your application';
  end if;
  if v_app.status <> 'accepted' then
    raise exception 'Application must be accepted';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if v_job is null or not public.job_allows_attendance(v_job) then
    raise exception 'Attendance is not available for this job status';
  end if;

  v_date := coalesce(p_work_date, v_today);
  if not (v_date = any (v_job.work_dates)) then
    raise exception 'Selected day is not a work day for this job';
  end if;
  if v_date <> v_today then
    raise exception 'Attendance requests are only allowed for today. Ask the business to correct missed days.';
  end if;

  if exists (
    select 1
    from public.attendance_events
    where application_id = p_application_id
      and kind = p_kind
      and work_date = v_date
  ) then
    raise exception 'Already recorded for this day';
  end if;

  if p_kind = 'check_out' and not exists (
    select 1
    from public.attendance_events
    where application_id = p_application_id
      and kind = 'check_in'
      and work_date = v_date
  ) then
    raise exception 'Confirmed check-in is required before check-out';
  end if;

  update public.attendance_requests
  set status = 'expired',
      updated_at = now()
  where application_id = p_application_id
    and kind = p_kind
    and work_date = v_date
    and status = 'pending'
    and expires_at <= now();

  select * into v_request
  from public.attendance_requests
  where application_id = p_application_id
    and kind = p_kind
    and work_date = v_date
    and status = 'pending'
  limit 1;

  if v_request is not null then
    return v_request;
  end if;

  insert into public.attendance_requests (
    application_id,
    kind,
    work_date,
    photo_path,
    lat,
    lng
  ) values (
    p_application_id,
    p_kind,
    v_date,
    trim(p_photo_path),
    p_lat,
    p_lng
  )
  returning * into v_request;

  select b.owner_id into v_owner
  from public.business_profiles b
  where b.id = v_job.business_id;

  select coalesce(nullif(trim(p.full_name), ''), 'A freelancer') into v_name
  from public.profiles p
  where p.id = v_app.freelancer_id;

  perform public.create_notification(
    v_owner,
    'attendance_request',
    coalesce(v_name, 'A freelancer') || ' is waiting',
    coalesce(v_name, 'A freelancer') || ' requested ' ||
      replace(p_kind::text, '_', '-') || ' confirmation for ' || v_job.title,
    jsonb_build_object(
      'job_id', v_job.id,
      'application_id', p_application_id,
      'request_id', v_request.id,
      'work_date', v_date,
      'kind', p_kind
    )
  );

  return v_request;
end;
$$;

create or replace function public.review_attendance_requests(
  p_request_ids uuid[],
  p_decision text,
  p_rejection_reason text default null
) returns setof public.attendance_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.attendance_requests;
  v_app public.applications;
  v_job public.jobs;
  v_event public.attendance_events;
  v_reason text;
  v_needed integer;
  v_done integer;
  v_id_count integer;
  v_processed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(cardinality(p_request_ids), 0) = 0 then
    raise exception 'Select at least one attendance request';
  end if;
  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'Decision must be confirmed or rejected';
  end if;

  v_reason := nullif(trim(coalesce(p_rejection_reason, '')), '');
  if p_decision = 'rejected' and length(coalesce(v_reason, '')) < 2 then
    raise exception 'A rejection reason is required';
  end if;

  select count(distinct request_id)::integer into v_id_count
  from unnest(p_request_ids) as request_id;
  if v_id_count <> cardinality(p_request_ids) then
    raise exception 'Duplicate attendance requests are not allowed';
  end if;

  for v_request in
    select r.*
    from public.attendance_requests r
    where r.id = any (p_request_ids)
    order by r.id
  loop
    select * into v_app
    from public.applications
    where id = v_request.application_id
    for update;

    select r.* into v_request
    from public.attendance_requests r
    where r.id = v_request.id
    for update;

    select * into v_job
    from public.jobs
    where id = v_app.job_id;

    if not public.is_job_business_owner(v_job.id) then
      raise exception 'Only the business owner can review attendance';
    end if;
    if v_request.status <> 'pending' then
      raise exception 'An attendance request is no longer pending';
    end if;
    if v_request.expires_at <= now() then
      raise exception 'An attendance request has expired';
    end if;
    if not public.job_allows_attendance(v_job) then
      raise exception 'Attendance is not available for this job status';
    end if;

    if p_decision = 'confirmed' then
      if v_request.kind = 'check_out' and not exists (
        select 1
        from public.attendance_events
        where application_id = v_request.application_id
          and kind = 'check_in'
          and work_date = v_request.work_date
      ) then
        raise exception 'Confirmed check-in is required before check-out';
      end if;

      insert into public.attendance_events (
        application_id,
        kind,
        work_date,
        photo_path,
        lat,
        lng,
        source
      ) values (
        v_request.application_id,
        v_request.kind,
        v_request.work_date,
        v_request.photo_path,
        v_request.lat,
        v_request.lng,
        'business_confirmation'
      )
      on conflict (application_id, kind, work_date) do nothing
      returning * into v_event;

      if v_request.kind = 'check_in' then
        update public.jobs
        set status = 'in_progress'
        where id = v_job.id
          and status in ('live', 'fully_staffed', 'confirmed');
      else
        select (
          (select count(*)::integer
           from public.applications
           where job_id = v_job.id and status = 'accepted')
          * greatest(1, cardinality(v_job.work_dates))
        ) into v_needed;

        select count(*)::integer into v_done
        from public.attendance_events e
        join public.applications a on a.id = e.application_id
        where a.job_id = v_job.id
          and a.status = 'accepted'
          and e.kind = 'check_out'
          and e.work_date = any (v_job.work_dates);

        if v_needed > 0 and v_done >= v_needed then
          update public.jobs set status = 'completed' where id = v_job.id;
        end if;
      end if;
    end if;

    update public.attendance_requests
    set status = p_decision,
        rejection_reason = case when p_decision = 'rejected' then v_reason else null end,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        updated_at = now()
    where id = v_request.id
    returning * into v_request;

    v_processed := v_processed + 1;

    perform public.create_notification(
      v_app.freelancer_id,
      case
        when p_decision = 'confirmed' then 'attendance_confirmed'
        else 'attendance_rejected'
      end,
      case
        when p_decision = 'confirmed' then
          case when v_request.kind = 'check_in' then 'Check-in confirmed' else 'Check-out confirmed' end
        else
          case when v_request.kind = 'check_in' then 'Check-in needs attention' else 'Check-out needs attention' end
      end,
      case
        when p_decision = 'confirmed' then
          'The business confirmed your ' || replace(v_request.kind::text, '_', '-') ||
          ' for ' || v_job.title
        else
          'The business declined your request: ' || v_reason
      end,
      jsonb_build_object(
        'job_id', v_job.id,
        'application_id', v_request.application_id,
        'request_id', v_request.id,
        'work_date', v_request.work_date,
        'kind', v_request.kind,
        'reason', v_reason
      )
    );

    return next v_request;
  end loop;

  if v_processed <> cardinality(p_request_ids) then
    raise exception 'One or more attendance requests were not found';
  end if;
end;
$$;

revoke all on function public.submit_attendance_request(
  uuid,
  public.attendance_kind,
  text,
  double precision,
  double precision,
  date
) from public, anon;
grant execute on function public.submit_attendance_request(
  uuid,
  public.attendance_kind,
  text,
  double precision,
  double precision,
  date
) to authenticated, service_role;

revoke all on function public.review_attendance_requests(uuid[], text, text)
  from public, anon;
grant execute on function public.review_attendance_requests(uuid[], text, text)
  to authenticated, service_role;
