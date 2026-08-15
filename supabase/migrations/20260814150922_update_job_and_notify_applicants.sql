create or replace function public.update_job_and_notify_applicants(
  p_job_id uuid,
  p_title text,
  p_description text,
  p_category public.job_category,
  p_skilled boolean,
  p_gender_preference text,
  p_headcount integer,
  p_work_dates date[],
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_address text,
  p_area text,
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_pay_per_freelancer integer,
  p_dress_code text,
  p_instructions text,
  p_food_allowance_inr integer,
  p_travel_allowance_inr integer
) returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_accepted_count integer;
  v_freelancer_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Gig title is required';
  end if;
  if p_headcount is null or p_headcount < 1 then
    raise exception 'Freelancer count must be at least 1';
  end if;
  if p_work_dates is null or cardinality(p_work_dates) < 1 then
    raise exception 'Select at least one work day';
  end if;
  if p_pay_per_freelancer is null or p_pay_per_freelancer <= 0 then
    raise exception 'Pay per freelancer must be greater than 0';
  end if;
  if nullif(trim(p_address), '') is null or nullif(trim(p_city), '') is null then
    raise exception 'Gig location is required';
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if v_job is null then
    raise exception 'Gig not found';
  end if;

  if not exists (
    select 1
    from public.business_profiles b
    where b.id = v_job.business_id
      and b.owner_id = (select auth.uid())
  ) then
    raise exception 'Only the business owner can edit this gig';
  end if;

  if v_job.status not in ('live', 'fully_staffed', 'confirmed') then
    raise exception 'Only upcoming active gigs can be edited';
  end if;

  select count(*)::integer
  into v_accepted_count
  from public.applications a
  where a.job_id = p_job_id
    and a.status = 'accepted';

  if p_headcount < v_accepted_count then
    raise exception 'Freelancer count cannot be lower than the number already selected';
  end if;

  update public.jobs
  set
    title = trim(p_title),
    description = nullif(trim(p_description), ''),
    category = p_category,
    skilled = p_skilled,
    gender_preference = p_gender_preference,
    headcount = p_headcount,
    job_date = p_work_dates[1],
    work_dates = p_work_dates,
    start_time = p_start_time,
    end_time = p_end_time,
    address = trim(p_address),
    area = nullif(trim(p_area), ''),
    city = trim(p_city),
    lat = p_lat,
    lng = p_lng,
    pay_per_freelancer = p_pay_per_freelancer,
    dress_code = nullif(trim(p_dress_code), ''),
    instructions = nullif(trim(p_instructions), ''),
    food_allowance_inr = p_food_allowance_inr,
    travel_allowance_inr = p_travel_allowance_inr
  where id = p_job_id
  returning * into v_job;

  perform public.refresh_job_staffing_status(p_job_id);
  select j.* into v_job from public.jobs j where j.id = p_job_id;

  for v_freelancer_id in
    select distinct a.freelancer_id
    from public.applications a
    where a.job_id = p_job_id
      and a.status in ('applied', 'accepted')
  loop
    insert into public.notifications (user_id, type, title, body, meta)
    values (
      v_freelancer_id,
      'job_updated',
      'Gig details updated',
      'The business updated details for ' || v_job.title || '. Review the gig before it starts.',
      jsonb_build_object('job_id', p_job_id)
    );
  end loop;

  return v_job;
end;
$$;

revoke all on function public.update_job_and_notify_applicants(
  uuid, text, text, public.job_category, boolean, text, integer, date[],
  time without time zone, time without time zone, text, text, text,
  double precision, double precision, integer, text, text, integer, integer
) from public;

grant execute on function public.update_job_and_notify_applicants(
  uuid, text, text, public.job_category, boolean, text, integer, date[],
  time without time zone, time without time zone, text, text, text,
  double precision, double precision, integer, text, text, integer, integer
) to authenticated;
