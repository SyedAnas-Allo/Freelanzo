-- Public, non-sensitive avatars keep existing consumers on stable URLs while
-- write access remains scoped to each authenticated user's top-level folder.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatar-images',
  'avatar-images',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "avatar_images_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatar-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Public bucket URLs already bypass RLS, but API downloads/list calls still
-- need an explicit SELECT so avatars remain readable for other signed-in users.
create policy "avatar_images_select_public"
on storage.objects
for select
to public
using (bucket_id = 'avatar-images');

create policy "avatar_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatar-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('profiles', 'businesses')
);

create policy "avatar_images_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatar-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatar-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('profiles', 'businesses')
);

create policy "avatar_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatar-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- The original SELECT policy exposed every attendance photo to every signed-in
-- account. Reading now requires either owning the upload folder or being the
-- business owner for an application whose request/event references the object.
drop policy if exists "attendance_photos_select" on storage.objects;
drop policy if exists "attendance_photos_update" on storage.objects;
drop policy if exists "attendance_photos_upload" on storage.objects;

create policy "attendance_photos_select_parties"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attendance-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.attendance_requests request
      join public.applications application
        on application.id = request.application_id
      where request.photo_path = storage.objects.name
        and public.is_job_business_owner(application.job_id)
    )
    or exists (
      select 1
      from public.attendance_events event
      join public.applications application
        on application.id = event.application_id
      where event.photo_path = storage.objects.name
        and public.is_job_business_owner(application.job_id)
    )
  )
);

create policy "attendance_photos_insert_own_job"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attendance-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.applications application
    where application.freelancer_id = (select auth.uid())
      and application.status = 'accepted'
      and application.job_id::text = (storage.foldername(name))[2]
  )
);

create policy "attendance_photos_update_own_job"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'attendance-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.attendance_requests request
    where request.photo_path = storage.objects.name
  )
  and not exists (
    select 1
    from public.attendance_events event
    where event.photo_path = storage.objects.name
  )
)
with check (
  bucket_id = 'attendance-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.applications application
    where application.freelancer_id = (select auth.uid())
      and application.status = 'accepted'
      and application.job_id::text = (storage.foldername(name))[2]
  )
);

create policy "attendance_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attendance-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.attendance_requests request
    where request.photo_path = storage.objects.name
  )
  and not exists (
    select 1
    from public.attendance_events event
    where event.photo_path = storage.objects.name
  )
);

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
set search_path = ''
as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_request public.attendance_requests;
  v_owner uuid;
  v_name text;
  v_date date;
  v_user_id uuid := (select auth.uid());
  v_today date := (timezone('Asia/Kolkata', now()))::date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_photo_path is null or length(btrim(p_photo_path)) = 0 then
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
  if v_app.freelancer_id <> v_user_id then
    raise exception 'Not your application';
  end if;
  if v_app.status <> 'accepted' then
    raise exception 'Application must be accepted';
  end if;

  select * into v_job
  from public.jobs
  where id = v_app.job_id;

  if v_job is null or not public.job_allows_attendance(v_job) then
    raise exception 'Attendance is not available for this job status';
  end if;

  if p_photo_path <> btrim(p_photo_path)
    or cardinality(string_to_array(p_photo_path, '/')) <> 3
    or split_part(p_photo_path, '/', 1) <> v_user_id::text
    or split_part(p_photo_path, '/', 2) <> v_job.id::text
    or length(split_part(p_photo_path, '/', 3)) = 0
    or not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'attendance-photos'
        and object.name = p_photo_path
        and (object.owner_id is null or object.owner_id = v_user_id::text)
    )
  then
    raise exception 'Attendance photo does not belong to this freelancer and job';
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
    btrim(p_photo_path),
    p_lat,
    p_lng
  )
  returning * into v_request;

  select business.owner_id into v_owner
  from public.business_profiles business
  where business.id = v_job.business_id;

  select coalesce(nullif(btrim(profile.full_name), ''), 'A freelancer') into v_name
  from public.profiles profile
  where profile.id = v_app.freelancer_id;

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
