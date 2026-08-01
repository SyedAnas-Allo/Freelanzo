"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { JobExperienceListItem } from "@/features/jobs/components/job-experience-list-item";
import {
  freelancerJobStatusLabel,
  freelancerJobStatusVariant,
} from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import type { ApplicationStatus, Job } from "@/types/database";

type ExperienceRow = {
  id: string;
  status: string;
  job: Job | null;
};

export default function WorkExperiencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExperienceRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: apps } = await supabase
        .from("applications")
        .select("id, status, created_at, jobs(*)")
        .eq("freelancer_id", user.id)
        .in("status", ["accepted", "cancelled"])
        .order("created_at", { ascending: false });

      setRows(
        (apps ?? []).map((a) => ({
          id: a.id,
          status: a.status as string,
          job: a.jobs as unknown as Job | null,
        })),
      );
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <PageLoading />;

  return (
    <PageContent>
      <PageHeader
        backHref="/profile"
        title="Work History"
        description="Gigs you’ve taken through Freelanzo."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase aria-hidden="true" className="size-5" />}
          title="No Gigs Yet"
          description="Accepted shifts will show up here as experience."
          action={{ label: "Find Gigs", href: "/freelancer" }}
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ id, status, job }) => {
            if (!job) return null;
            return (
              <JobExperienceListItem
                key={id}
                job={job}
                statusLabel={freelancerJobStatusLabel(
                  status as ApplicationStatus,
                  job.status,
                )}
                statusVariant={freelancerJobStatusVariant(
                  status as ApplicationStatus,
                  job.status,
                )}
              />
            );
          })}
        </div>
      )}
    </PageContent>
  );
}
