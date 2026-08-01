import Link from "next/link";
import {
  Bookmark,
  Briefcase,
  Building2,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { SectionHeader } from "@/components/layout/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { BusinessJobListItem } from "@/features/jobs/components/business-job-list-item";
import { getSessionProfile } from "@/lib/auth";
import { isActiveJob } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { greetingForNow } from "@/lib/utils";
import type { Job } from "@/types/database";

export default async function BusinessHomePage() {
  const { profile, business } = await getSessionProfile();
  const supabase = await createClient();

  if (!business) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-extrabold tracking-tight">
          {greetingForNow()},{" "}
          <span className="font-semibold">
            {(profile?.full_name || "there").split(" ")[0]}
          </span>
        </h1>
        <p className="mt-0.5 text-sm font-light text-muted-foreground">
          Hire local freelancers when you&apos;re ready.
        </p>

        <EmptyState
          className="mt-8 rounded-2xl"
          icon={<Building2 aria-hidden="true" className="size-5" />}
          title="Ready to hire?"
          description="Post a gig when you need freelancers — we'll ask for your business details then."
          action={{
            label: "Post a Gig",
            href: "/business/jobs/new",
          }}
        />
      </div>
    );
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const jobList = (jobs ?? []) as Job[];
  const activeJobs = jobList.filter((job) => isActiveJob(job.status));

  const jobIds = jobList.map((j) => j.id);
  let applicantCount = 0;
  const applicantsByJob = new Map<string, number>();

  if (jobIds.length) {
    const { data: apps } = await supabase
      .from("applications")
      .select("job_id")
      .in("job_id", jobIds);
    for (const row of apps ?? []) {
      applicantsByJob.set(
        row.job_id,
        (applicantsByJob.get(row.job_id) ?? 0) + 1,
      );
    }
    applicantCount = apps?.length ?? 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  const hiredToday =
    jobIds.length === 0
      ? 0
      : (
          await supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .in("job_id", jobIds)
            .eq("status", "accepted")
            .gte("updated_at", `${today}T00:00:00`)
        ).count ?? 0;

  const stats = [
    {
      label: "Active Gigs",
      value: activeJobs.length,
      icon: Briefcase,
      href: "/business/jobs",
    },
    {
      label: "Applicants",
      value: applicantCount,
      icon: Users,
      href: "/business/jobs",
    },
    {
      label: "Hired Today",
      value: hiredToday,
      icon: Building2,
      href: "/business/jobs",
    },
  ];

  return (
    <div className="px-4 py-4">
      <p className="flex items-center gap-1.5 text-sm">
        <MapPin className="size-3.5 shrink-0 text-primary" />
        <span className="font-semibold text-foreground">
          {(business.address || profile?.area || "Bangalore").split(",")[0]}
        </span>
        <span className="font-light text-muted-foreground">, Bangalore</span>
      </p>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            {greetingForNow()},{" "}
            <span className="font-semibold">{business.business_name}</span>
          </h1>
          <p className="mt-0.5 text-sm font-light text-muted-foreground">
            Let&apos;s hire the best local talent today.
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Building2 className="size-6" />
        </div>
      </div>

      <div className="mt-4 flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            href={stat.href}
            tone="brand"
            className="min-w-[132px] flex-1 rounded-2xl p-3.5"
            icon={<stat.icon aria-hidden="true" className="size-4" />}
            value={stat.value}
            label={stat.label}
            hint="View All →"
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {[
          { href: "/business/jobs/new", icon: Plus, label: "Post New Gig" },
          { href: "/business/jobs", icon: Briefcase, label: "My Gigs" },
          { href: "/profile", icon: Bookmark, label: "Profile" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_2px_10px_rgba(40,20,80,0.04)]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
              <item.icon className="size-4" />
            </span>
            <span className="text-center text-[10px] font-semibold leading-tight text-foreground">
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      <SectionHeader
        className="mt-6"
        title="Recent Active Gigs"
        action={{ label: "View All →", href: "/business/jobs" }}
      />

      <div className="mt-3 space-y-2.5">
        {activeJobs.length === 0 ? (
          <EmptyState
            className="rounded-2xl py-6"
            title="No Active Gigs"
            action={{ label: "Post Your First Gig", href: "/business/jobs/new" }}
          />
        ) : (
          activeJobs.slice(0, 5).map((job) => (
            <BusinessJobListItem
              key={job.id}
              job={job}
              applicantCount={applicantsByJob.get(job.id) ?? 0}
              href={`/business/jobs/${job.id}/applicants`}
            />
          ))
        )}
      </div>
    </div>
  );
}
