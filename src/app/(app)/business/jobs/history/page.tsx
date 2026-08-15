"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { FilterChipRow } from "@/components/filter-chip-row";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { Input } from "@/components/ui/input";
import { JobHistoryListItem } from "@/features/jobs/components/job-history-list-item";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import { createClient } from "@/lib/supabase/client";
import { effectiveJobStatus, isActiveJob } from "@/lib/status";
import type { Job } from "@/types/database";

export default function JobHistoryPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobHistoryContent />
    </Suspense>
  );
}

function JobHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "all";
  const q = searchParams.get("q") ?? "";
  const {
    user,
    business,
    loading: sessionLoading,
    reload,
  } = useSessionProfile();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      let biz = business;
      if (!biz) {
        const next = await reload();
        if (cancelled) return;
        biz = next.business;
        if (!biz) {
          router.replace("/business/setup");
          return;
        }
      }

      const supabase = createClient();
      const { data: jobs } = await supabase
        .from("jobs")
        .select("*")
        .eq("business_id", biz.id)
        .order("job_date", { ascending: false });

      if (cancelled) return;
      setAllJobs((jobs ?? []) as Job[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, user, business, reload, router]);

  if (sessionLoading || loading || !business) {
    return <PageLoading />;
  }

  let list = allJobs;
  const isActive = (job: Job) => isActiveJob(effectiveJobStatus(job));
  const counts = {
    active: list.filter(isActive).length,
    completed: list.filter((j) => j.status === "completed").length,
    cancelled: list.filter((j) => j.status === "cancelled").length,
  };

  if (tab === "active") {
    list = list.filter(isActive);
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
