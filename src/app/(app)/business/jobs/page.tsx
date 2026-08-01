import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { JobLifecycleSummaryBar } from "@/components/lifecycle-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { summarizeJobLifecycles } from "@/lib/application-lifecycle";
import { getSessionProfile } from "@/lib/auth";
import { loadApplicationLifecycles } from "@/lib/load-application-lifecycles";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/feedback/empty-state";
import { jobStatusLabel, jobStatusVariant } from "@/lib/status";
import type { ApplicationStatus, Job } from "@/types/database";

type AppRow = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
};

export default async function BusinessJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "all" } = await searchParams;
  const { user, business } = await getSessionProfile();

  if (!business) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-extrabold">My Gigs</h1>
        <EmptyState
          className="mt-8 rounded-2xl"
          title="No gigs yet"
          description="Post a gig when you&apos;re ready — we&apos;ll ask for your business details then."
          action={{ label: "Post a Gig", href: "/business/jobs/new" }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const list = (jobs ?? []) as Job[];
  const jobIds = list.map((job) => job.id);

  const { data: appsData } = jobIds.length
    ? await supabase
        .from("applications")
        .select("id, job_id, status")
        .in("job_id", jobIds)
    : { data: [] };

  const apps = (appsData ?? []) as AppRow[];
  const jobsById = new Map(list.map((job) => [job.id, job]));
  const acceptedCountByJob = new Map<string, number>();
  const appliedCountByJob = new Map<string, number>();
  for (const app of apps) {
    if (app.status === "accepted") {
      acceptedCountByJob.set(
        app.job_id,
        (acceptedCountByJob.get(app.job_id) ?? 0) + 1,
      );
    }
    if (app.status === "applied") {
      appliedCountByJob.set(
        app.job_id,
        (appliedCountByJob.get(app.job_id) ?? 0) + 1,
      );
    }
  }

  const lifecycles = await loadApplicationLifecycles(supabase, {
    applications: apps,
    jobsById,
    actor: "business",
    actorUserId: user!.id,
    acceptedCountByJob,
  });

  const filtered =
    tab === "all"
      ? list
      : tab === "active"
        ? list.filter((j) =>
            [
              "live",
              "fully_staffed",
              "confirmed",
              "in_progress",
            ].includes(j.status),
          )
        : tab === "completed"
          ? list.filter((j) => j.status === "completed")
          : list.filter((j) => j.status === tab);

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">My Gigs</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" asChild>
            <Link href="/business/jobs/history">History</Link>
          </Button>
          <Button size="sm" className="rounded-xl" asChild>
            <Link href="/business/jobs/new">Post Gig</Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto hide-scrollbar">
        {["all", "active", "fully_staffed", "completed", "cancelled"].map((t) => (
          <Badge
            key={t}
            variant={tab === t ? "default" : "outline"}
            className="shrink-0 capitalize"
            asChild
          >
            <Link href={`/business/jobs?tab=${t}`}>
              {t.replace("_", " ")}
            </Link>
          </Badge>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            title="No gigs in this status"
            description="Your gigs will appear here as their status changes."
          />
        ) : (
          filtered.map((job) => {
            const jobLifecycles = apps
              .filter((a) => a.job_id === job.id)
              .map((a) => lifecycles.get(a.id))
              .filter((l): l is NonNullable<typeof l> => !!l);
            const summary = summarizeJobLifecycles(
              job.id,
              job.headcount,
              job.status,
              jobLifecycles,
              appliedCountByJob.get(job.id) ?? 0,
            );
            const isClosed = ["completed", "cancelled", "expired"].includes(
              job.status,
            );
            return (
              <JobCard
                key={job.id}
                job={job}
                statusLabel={jobStatusLabel(job.status)}
                statusVariant={jobStatusVariant(job.status)}
                href={`/business/jobs/${job.id}/applicants`}
                actionLabel={isClosed ? "View" : "Manage"}
                footer={<JobLifecycleSummaryBar summary={summary} />}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
