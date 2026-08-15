"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadErrorCard } from "@/components/feedback/load-error-card";
import { JobCard } from "@/components/job-card";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { useRouter } from "@/hooks/use-app-router";
import { useSessionProfile } from "@/hooks/use-session-profile";
import {
  effectiveJobStatus,
  jobStatusLabel,
  jobStatusVariant,
} from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import type { Job, SavedJob } from "@/types/database";

type SavedJobWithDetails = SavedJob & {
  jobs: Job & {
    business_profiles: {
      business_name: string;
      verified: boolean;
    } | null;
  };
};

export default function SavedJobsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSessionProfile();
  const [savedJobs, setSavedJobs] = useState<SavedJobWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("*, jobs(*, business_profiles(business_name, verified))")
        .eq("freelancer_id", user!.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as (SavedJob & {
        jobs:
          | (Job & {
              business_profiles: {
                business_name: string;
                verified: boolean;
              } | null;
            })
          | null;
      })[];

      setSavedJobs(
        rows.filter(
          (row): row is SavedJobWithDetails => row.jobs != null,
        ),
      );
      setLoadError(false);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, user, router, retryKey]);

  if (sessionLoading || loading) return <PageLoading />;

  return (
    <PageContent className="pb-4 pt-2">
      <PageHeader
        title="Saved Gigs"
        description="Gigs you want to revisit"
        backHref="/freelancer/my-jobs"
      />

      <div className="mt-4 space-y-3">
        {loadError ? (
          <LoadErrorCard
            title="Couldn't load saved gigs"
            onRetry={() => {
              setLoading(true);
              setRetryKey((key) => key + 1);
            }}
          />
        ) : savedJobs.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-5" />}
            title="No saved gigs yet"
            description="Open a gig and tap the heart to save it here."
            action={{ label: "Find gigs nearby", href: "/freelancer" }}
          />
        ) : (
          savedJobs.map((savedJob) => {
            const job = savedJob.jobs;
            const status = effectiveJobStatus(job);
            const unavailable = status !== "live";

            return (
              <JobCard
                key={job.id}
                job={job}
                businessName={job.business_profiles?.business_name}
                verified={job.business_profiles?.verified}
                statusLabel={unavailable ? jobStatusLabel(status) : undefined}
                statusVariant={
                  unavailable ? jobStatusVariant(status) : undefined
                }
                href={`/freelancer/jobs/${job.id}`}
              />
            );
          })
        )}
      </div>
    </PageContent>
  );
}
