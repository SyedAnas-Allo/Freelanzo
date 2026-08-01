import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { FilterChipRow } from "@/components/filter-chip-row";
import { JobCard } from "@/components/job-card";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionProfile } from "@/lib/auth";
import {
  freelancerJobStatusLabel,
  freelancerJobStatusVariant,
  isAcceptedCompletedWork,
  isAcceptedSelectedWork,
} from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Application, Job } from "@/types/database";

type TabKey =
  | "all"
  | "applied"
  | "accepted"
  | "completed"
  | "rejected"
  | "cancelled";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied" },
  { key: "accepted", label: "Selected" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Withdrawn" },
];

function matchesTab(
  applicationStatus: Application["status"],
  jobStatus: Job["status"],
  tab: TabKey,
): boolean {
  if (tab === "all") return true;
  if (tab === "completed") {
    return isAcceptedCompletedWork(applicationStatus, jobStatus);
  }
  if (tab === "accepted") {
    return isAcceptedSelectedWork(applicationStatus, jobStatus);
  }
  return applicationStatus === tab;
}

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab = "all" } = await searchParams;
  const tab = (
    TABS.some((item) => item.key === rawTab) ? rawTab : "all"
  ) as TabKey;
  const { user } = await getSessionProfile();
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from("applications")
    .select("*, jobs(*, business_profiles(business_name, verified))")
    .eq("freelancer_id", user!.id)
    .order("created_at", { ascending: false });

  const rows = (apps ?? []) as (Application & {
    jobs:
      | (Job & {
          business_profiles: {
            business_name: string;
            verified: boolean;
          } | null;
        })
      | null;
  })[];

  const withJobs = rows.filter(
    (row): row is typeof row & { jobs: NonNullable<typeof row.jobs> } =>
      row.jobs != null,
  );

  const filtered = withJobs.filter((a) =>
    matchesTab(a.status, a.jobs.status, tab),
  );

  const counts = {
    applied: withJobs.filter((a) => a.status === "applied").length,
    accepted: withJobs.filter((a) =>
      isAcceptedSelectedWork(a.status, a.jobs.status),
    ).length,
    completed: withJobs.filter((a) =>
      isAcceptedCompletedWork(a.status, a.jobs.status),
    ).length,
    rejected: withJobs.filter((a) => a.status === "rejected").length,
  };

  return (
    <PageContent className="pb-4 pt-2">
      <PageHeader
        title="My Gigs"
        description="Applications & selected work"
        action={
          <ClipboardList
            aria-hidden="true"
            className="size-5 text-primary/40"
          />
        }
      />

      <div className="mt-3 flex divide-x divide-border/60 overflow-hidden rounded-xl bg-primary/[0.04]">
        {(
          [
            ["Applied", counts.applied, "applied"],
            ["Selected", counts.accepted, "accepted"],
            ["Completed", counts.completed, "completed"],
            ["Rejected", counts.rejected, "rejected"],
          ] as const
        ).map(([label, value, key]) => (
          <Link
            key={key}
            href={`/freelancer/my-jobs?tab=${key}`}
            className={cn(
              "flex-1 px-1.5 py-2.5 text-center transition-colors",
              tab === key && "bg-primary/10",
            )}
          >
            <p className="text-base font-extrabold text-primary">{value}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">
              {label}
            </p>
          </Link>
        ))}
      </div>

      <FilterChipRow
        activeKey={tab}
        chips={TABS.map((item) => ({
          key: item.key,
          label: item.label,
          href: `/freelancer/my-jobs?tab=${item.key}`,
        }))}
      />

      <div className="mt-4 space-y-2.5">
        {filtered.length === 0 ? (
          <EmptyState
            title="No gigs here yet"
            description="Apply nearby and track status on this page."
            action={{ label: "Find gigs nearby", href: "/freelancer" }}
          />
        ) : (
          filtered.map((app) => (
            <JobCard
              key={app.id}
              job={app.jobs}
              businessName={app.jobs.business_profiles?.business_name}
              verified={app.jobs.business_profiles?.verified}
              statusLabel={freelancerJobStatusLabel(
                app.status,
                app.jobs.status,
              )}
              statusVariant={freelancerJobStatusVariant(
                app.status,
                app.jobs.status,
              )}
              href={`/freelancer/jobs/${app.job_id}`}
            />
          ))
        )}
      </div>
    </PageContent>
  );
}
