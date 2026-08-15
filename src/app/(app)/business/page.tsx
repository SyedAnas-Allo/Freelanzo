"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Building2,
  Gift,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { SectionHeader } from "@/components/layout/section-header";
import { PageLoading } from "@/components/page-loading";
import { StatCard } from "@/components/shared/stat-card";
import { BusinessJobListItem } from "@/features/jobs/components/business-job-list-item";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import { isActiveJob } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import { greetingForNow } from "@/lib/utils";
import type { Job } from "@/types/database";

export default function BusinessHomePage() {
  const router = useRouter();
  const {
    user,
    profile,
    business,
    loading: sessionLoading,
  } = useSessionProfile();
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [totalJobCount, setTotalJobCount] = useState(0);
  const [applicantsByJob, setApplicantsByJob] = useState<Map<string, number>>(
    new Map(),
  );
  const [applicantCount, setApplicantCount] = useState(0);
  const [hiredToday, setHiredToday] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    if (!business) return;

    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data: jobs } = await supabase
        .from("jobs")
        .select("*")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });

      const jobList = (jobs ?? []) as Job[];
      const nextActive = jobList.filter((job) => isActiveJob(job.status));
      if (cancelled) return;
      setActiveJobs(nextActive);
      setTotalJobCount(jobList.length);

      const jobIds = jobList.map((j) => j.id);
      let nextApplicantCount = 0;
      const nextApplicantsByJob = new Map<string, number>();
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: apps }, { count: hiredCount }] = jobIds.length
        ? await Promise.all([
            supabase
              .from("applications")
              .select("job_id")
              .in("job_id", jobIds),
            supabase
              .from("applications")
              .select("*", { count: "exact", head: true })
              .in("job_id", jobIds)
              .eq("status", "accepted")
              .gte("updated_at", `${today}T00:00:00`),
          ])
        : [{ data: [] }, { count: 0 }];

      if (jobIds.length) {
        for (const row of apps ?? []) {
          nextApplicantsByJob.set(
            row.job_id,
            (nextApplicantsByJob.get(row.job_id) ?? 0) + 1,
          );
        }
        nextApplicantCount = apps?.length ?? 0;
      }

      if (cancelled) return;
      setApplicantsByJob(nextApplicantsByJob);
      setApplicantCount(nextApplicantCount);
      setHiredToday(hiredCount ?? 0);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, user, business, router]);

  if (sessionLoading) {
    return <PageLoading />;
  }

  if (!business) {
    return (
      <div className="px-4">
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

  const freePostsRemaining = Math.max(0, 2 - totalJobCount);
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
    <div className="px-4">
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

      {freePostsRemaining > 0 ? (
        <Link
          href="/business/jobs/new"
          className="group relative mt-5 block overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200/80 px-4 py-4 shadow-sm shadow-amber-300/30 outline-none transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
          aria-label={`Post a gig for free. ${freePostsRemaining} free ${freePostsRemaining === 1 ? "post" : "posts"} remaining.`}
        >
          <span
            aria-hidden="true"
            className="absolute -right-8 -top-10 size-32 rounded-full border-[18px] border-amber-300/50"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-9 right-16 size-20 rounded-full bg-orange-300/35"
          />

          <div className="relative flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 ring-1 ring-inset ring-amber-300">
              <Gift className="size-5 text-amber-800" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800/70">
                New business offer
              </p>
              <h2 className="mt-0.5 text-base font-extrabold tracking-tight text-amber-950">
                Your first 2 gig posts are free
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/70">
                Hire local talent with no posting fee. No code needed.
              </p>
            </div>
          </div>

          <div className="relative mt-3 flex items-center justify-between border-t border-dashed border-amber-400/50 pt-3">
            <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
              {freePostsRemaining} free{" "}
              {freePostsRemaining === 1 ? "post" : "posts"} left
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-900">
              Post a free gig
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ) : null}

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
