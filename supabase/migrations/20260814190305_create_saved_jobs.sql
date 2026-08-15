CREATE TABLE public.saved_jobs (
  freelancer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (freelancer_id, job_id)
);

CREATE INDEX saved_jobs_freelancer_created_idx
  ON public.saved_jobs (freelancer_id, created_at DESC);

CREATE INDEX saved_jobs_job_id_idx ON public.saved_jobs (job_id);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_jobs_select_own"
ON public.saved_jobs
FOR SELECT
TO authenticated
USING (freelancer_id = (SELECT auth.uid()));

CREATE POLICY "saved_jobs_insert_own"
ON public.saved_jobs
FOR INSERT
TO authenticated
WITH CHECK (freelancer_id = (SELECT auth.uid()));

CREATE POLICY "saved_jobs_delete_own"
ON public.saved_jobs
FOR DELETE
TO authenticated
USING (freelancer_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.saved_jobs FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_jobs TO authenticated;
GRANT ALL ON TABLE public.saved_jobs TO service_role;

-- Allow freelancers to keep reading saved gigs after they expire/cancel.
CREATE OR REPLACE FUNCTION public.is_job_saved(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.saved_jobs s
    WHERE s.job_id = p_job_id
      AND s.freelancer_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_job_saved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_job_saved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_job_saved(uuid) TO service_role;

DROP POLICY IF EXISTS "jobs_select_live_or_owner" ON public.jobs;

CREATE POLICY "jobs_select_live_or_owner"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  (
    status = ANY (
      ARRAY[
        'live'::public.job_status,
        'fully_staffed'::public.job_status,
        'confirmed'::public.job_status,
        'in_progress'::public.job_status,
        'completed'::public.job_status
      ]
    )
  )
  OR (
    business_id IN (
      SELECT business_profiles.id
      FROM public.business_profiles
      WHERE business_profiles.owner_id = (SELECT auth.uid())
    )
  )
  OR (SELECT public.is_job_applicant(jobs.id))
  OR (SELECT public.is_job_saved(jobs.id))
);
