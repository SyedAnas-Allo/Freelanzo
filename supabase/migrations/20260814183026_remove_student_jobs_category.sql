-- Remove job_category enum value student_jobs (remap existing rows to other).

UPDATE public.jobs
SET category = 'other'
WHERE category = 'student_jobs';

DROP FUNCTION IF EXISTS public.update_job_and_notify_applicants(
  uuid, text, text, public.job_category, boolean, text, integer, date[],
  time without time zone, time without time zone, text, text, text,
  double precision, double precision, integer, text, text, integer, integer
);

CREATE TYPE public.job_category_new AS ENUM (
  'hospitality',
  'event',
  'promoter',
  'delivery',
  'warehouse',
  'security',
  'other',
  'catering',
  'retail',
  'corporate',
  'sports',
  'talent',
  'labour',
  'cleaning'
);

ALTER TABLE public.jobs
  ALTER COLUMN category DROP DEFAULT;

ALTER TABLE public.jobs
  ALTER COLUMN category TYPE public.job_category_new
  USING category::text::public.job_category_new;

ALTER TABLE public.jobs
  ALTER COLUMN category SET DEFAULT 'other'::public.job_category_new;

DROP TYPE public.job_category;

ALTER TYPE public.job_category_new RENAME TO job_category;

CREATE OR REPLACE FUNCTION public.update_job_and_notify_applicants(
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
) RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.jobs;
  v_accepted_count integer;
  v_freelancer_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF nullif(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Gig title is required';
  END IF;
  IF p_headcount IS NULL OR p_headcount < 1 THEN
    RAISE EXCEPTION 'Freelancer count must be at least 1';
  END IF;
  IF p_work_dates IS NULL OR cardinality(p_work_dates) < 1 THEN
    RAISE EXCEPTION 'Select at least one work day';
  END IF;
  IF p_pay_per_freelancer IS NULL OR p_pay_per_freelancer <= 0 THEN
    RAISE EXCEPTION 'Pay per freelancer must be greater than 0';
  END IF;
  IF nullif(trim(p_address), '') IS NULL OR nullif(trim(p_city), '') IS NULL THEN
    RAISE EXCEPTION 'Gig location is required';
  END IF;

  SELECT j.*
  INTO v_job
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Gig not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_profiles b
    WHERE b.id = v_job.business_id
      AND b.owner_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only the business owner can edit this gig';
  END IF;

  IF v_job.status NOT IN ('live', 'fully_staffed', 'confirmed') THEN
    RAISE EXCEPTION 'Only upcoming active gigs can be edited';
  END IF;

  SELECT count(*)::integer
  INTO v_accepted_count
  FROM public.applications a
  WHERE a.job_id = p_job_id
    AND a.status = 'accepted';

  IF p_headcount < v_accepted_count THEN
    RAISE EXCEPTION 'Freelancer count cannot be lower than the number already selected';
  END IF;

  UPDATE public.jobs
  SET
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
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  PERFORM public.refresh_job_staffing_status(p_job_id);
  SELECT j.* INTO v_job FROM public.jobs j WHERE j.id = p_job_id;

  FOR v_freelancer_id IN
    SELECT DISTINCT a.freelancer_id
    FROM public.applications a
    WHERE a.job_id = p_job_id
      AND a.status IN ('applied', 'accepted')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    VALUES (
      v_freelancer_id,
      'job_updated',
      'Gig details updated',
      'The business updated details for ' || v_job.title || '. Review the gig before it starts.',
      jsonb_build_object('job_id', p_job_id)
    );
  END LOOP;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.update_job_and_notify_applicants(
  uuid, text, text, public.job_category, boolean, text, integer, date[],
  time without time zone, time without time zone, text, text, text,
  double precision, double precision, integer, text, text, integer, integer
) FROM public;

GRANT EXECUTE ON FUNCTION public.update_job_and_notify_applicants(
  uuid, text, text, public.job_category, boolean, text, integer, date[],
  time without time zone, time without time zone, text, text, text,
  double precision, double precision, integer, text, text, integer, integer
) TO authenticated;
