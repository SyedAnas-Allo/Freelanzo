alter table public.applications
  add column rejection_reason text;

alter table public.applications
  add constraint applications_rejection_reason_length
  check (char_length(rejection_reason) <= 500);

drop function public.set_application_status(uuid, public.application_status);

create function public.set_application_status(
  p_application_id uuid,
  p_status public.application_status,
  p_rejection_reason text default null
)
returns public.applications
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_accepted integer;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'Business may only accept or reject';
  end if;

  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if v_app is null then
    raise exception 'Application not found';
  end if;

  select * into v_job
  from public.jobs
  where id = v_app.job_id
  for update;

  if v_job is null then
    raise exception 'Job not found';
  end if;

  if not public.is_job_business_owner(v_job.id) then
    raise exception 'Only business owner can change selection';
  end if;

  if v_job.status not in ('live', 'fully_staffed', 'confirmed') then
    raise exception 'Selection is closed for this job';
  end if;

  if v_app.status = 'cancelled' then
    raise exception 'Cannot change a withdrawn application';
  end if;

  if exists (
    select 1
    from public.attendance_events e
    where e.application_id = p_application_id
  ) and p_status <> v_app.status then
    raise exception 'Cannot change selection after attendance has started';
  end if;

  if p_status = 'accepted' and v_app.status <> 'accepted' then
    select count(*)::integer into v_accepted
    from public.applications
    where job_id = v_job.id and status = 'accepted';

    if v_accepted >= v_job.headcount then
      raise exception 'All openings are filled';
    end if;
  end if;

  v_reason := nullif(btrim(p_rejection_reason), '');

  if p_status = 'rejected' and v_app.status = 'accepted' and v_reason is null then
    raise exception 'A rejection reason is required for a selected freelancer';
  end if;

  if char_length(v_reason) > 500 then
    raise exception 'Rejection reason must be 500 characters or fewer';
  end if;

  update public.applications
  set
    status = p_status,
    rejection_reason = case
      when p_status = 'rejected' then v_reason
      else null
    end
  where id = p_application_id
  returning * into v_app;

  return v_app;
end;
$$;

revoke all on function public.set_application_status(
  uuid,
  public.application_status,
  text
) from public;

grant execute on function public.set_application_status(
  uuid,
  public.application_status,
  text
) to authenticated;

grant execute on function public.set_application_status(
  uuid,
  public.application_status,
  text
) to service_role;
