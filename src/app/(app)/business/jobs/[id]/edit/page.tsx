"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { InfoCallout } from "@/components/info-callout";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { JobBasicsFields } from "@/features/jobs/post-job/job-basics-fields";
import { JobDescriptionFields } from "@/features/jobs/post-job/job-description-fields";
import { JobScheduleFields } from "@/features/jobs/post-job/job-schedule-fields";
import { useEditJobForm } from "@/features/jobs/post-job/use-edit-job-form";
import { useRouter } from "@/hooks/use-app-router";
import { fetchBusinessSession } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/database";

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { user, business } = await fetchBusinessSession();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!business) {
        router.replace("/business/setup");
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("business_id", business.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        toast.error(error?.message ?? "Gig not found");
        router.replace("/business/jobs");
        return;
      }
      if (!["live", "fully_staffed", "confirmed"].includes(data.status)) {
        toast.error("Only upcoming active gigs can be edited");
        router.replace(`/business/jobs/${id}/applicants`);
        return;
      }

      setJob(data as Job);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading || !job) return <PageLoading />;
  return <EditJobForm job={job} />;
}

function EditJobForm({ job }: { job: Job }) {
  const { controller, loading, scheduleLocked, save } = useEditJobForm(job);

  return (
    <PageContent className="pb-10">
      <PageHeader
        backHref={`/business/jobs/${job.id}/applicants`}
        title="Edit Gig"
        description="Update the information freelancers use to plan for this gig."
      />

      {scheduleLocked ? (
        <InfoCallout
          title="Schedule locked"
          icon={<CalendarClock className="size-4" />}
        >
          Dates and times cannot change after freelancers apply. Other details
          can still be updated.
        </InfoCallout>
      ) : null}

      <JobBasicsFields controller={controller} />
      <JobScheduleFields
        controller={controller}
        scheduleLocked={scheduleLocked}
      />
      <JobDescriptionFields controller={controller} />

      {job.active_application_count > 0 ? (
        <InfoCallout title="Freelancers will be notified" icon={<Bell className="size-4" />}>
          Everyone currently applied or selected for this gig will receive an
          update notification after you save.
        </InfoCallout>
      ) : null}

      <Button
        className="h-12 w-full rounded-xl"
        disabled={loading}
        onClick={() => void save()}
      >
        <Save className="size-4" />
        {loading ? "Saving…" : "Save Changes"}
      </Button>
    </PageContent>
  );
}
