import { redirect } from "next/navigation";
import { Briefcase, Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { FilterChipRow } from "@/components/filter-chip-row";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { JobHistoryListItem } from "@/features/jobs/components/job-history-list-item";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isActiveJob } from "@/lib/status";
import type { Job } from "@/types/database";

export default async function JobHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = "all", q = "" } = await searchParams;
  const { business } = await getSessionProfile();
  if (!business) redirect("/business/setup");

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("business_id", business.id)
    .order("job_date", { ascending: false });

  let list = (jobs ?? []) as Job[];
  const counts = {
    active: list.filter((job) => isActiveJob(job.status)).length,
    completed: list.filter((j) => j.status === "completed").length,
    cancelled: list.filter((j) => j.status === "cancelled").length,
  };

  if (tab === "active") {
    list = list.filter((job) => isActiveJob(job.status));
  } else if (tab === "completed") {
    list = list.filter((j) => j.status === "completed");
  } else if (tab === "cancelled") {
    list = list.filter((j) => j.status === "cancelled");
  }

  if (q.trim()) {
    const needle = q.toLowerCase();
    list = list.filter(
      (j) =>
        j.title.toLowerCase().includes(needle) ||
        (j.area || "").toLowerCase().includes(needle) ||
        j.city.toLowerCase().includes(needle),
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Gig History"
        description="Review active, completed, and cancelled gigs."
        backHref="/business/jobs"
      />

      <FilterChipRow
        className="mt-4"
        activeKey={tab}
        chips={[
          { key: "all", label: "All", href: "/business/jobs/history?tab=all" },
          {
            key: "active",
            label: `Active (${counts.active})`,
            href: "/business/jobs/history?tab=active",
          },
          {
            key: "completed",
            label: `Completed (${counts.completed})`,
            href: "/business/jobs/history?tab=completed",
          },
          {
            key: "cancelled",
            label: `Cancelled (${counts.cancelled})`,
            href: "/business/jobs/history?tab=cancelled",
          },
        ]}
      />

      <form className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          aria-label="Search gig history"
          defaultValue={q}
          placeholder="Search by gig title or location…"
          className="rounded-xl pl-9"
        />
        <input type="hidden" name="tab" value={tab} />
      </form>

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <EmptyState
            icon={<Briefcase aria-hidden="true" className="size-5" />}
            title="No Matching Gigs"
            description="Try another status or search term."
          />
        ) : (
          list.map((job) => <JobHistoryListItem key={job.id} job={job} />)
        )}
      </div>
    </PageContent>
  );
}
