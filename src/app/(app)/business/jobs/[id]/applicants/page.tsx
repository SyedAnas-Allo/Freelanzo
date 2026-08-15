"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";
import { ContactActionBar } from "@/components/actions/contact-action-bar";
import { ApplicantActions } from "@/components/applicant-actions";
import { JobActionsMenu } from "@/components/job-actions-menu";
import { ReportMenuButton } from "@/components/report-menu-button";
import {
  AttendanceRecordCard,
  type AttendanceRecordView,
} from "@/components/attendance-record-card";
import {
  JobLifecycleSummaryBar,
  LifecycleTracker,
} from "@/components/lifecycle-tracker";
import { EmptyState } from "@/components/feedback/empty-state";
import { SuccessScreen } from "@/components/feedback/success-screen";
import { PageBack } from "@/components/page-back";
import { PageLoading } from "@/components/page-loading";
import { ReferJobButton } from "@/components/refer-button";
import { SosCallout } from "@/components/sos-callout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ApplicantFilterTabs } from "@/features/applications/components/applicant-filter-tabs";
import {
  summarizeJobLifecycles,
  type ApplicationLifecycle,
  type JobLifecycleSummary,
} from "@/lib/application-lifecycle";
import { useRouter } from "@/hooks/use-app-router";
import { fetchBusinessSession } from "@/hooks/use-session-profile";
import { loadApplicationLifecycles } from "@/lib/load-application-lifecycles";
import { loadAttendanceBundleByApplication } from "@/lib/load-attendance-records";
import {
  applicationStatusLabel,
  applicationStatusToneClassName,
  effectiveJobStatus,
  isActiveJob,
  isHiredStatus,
  isJobPhoneUnlocked,
  jobStatusLabel,
} from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  formatPay,
  formatTime,
  jobDayTotal,
  jobEngagementTotal,
} from "@/lib/utils";
import { formatWorkDatesLabel, jobWorkDates } from "@/lib/work-dates";
import type { Application, Job, Profile } from "@/types/database";

type AppRow = Application & { profiles: Profile };

type PageData = {
  job: Job;
  rows: AppRow[];
  lifecycles: Map<string, ApplicationLifecycle>;
  attendanceByApp: Map<string, AttendanceRecordView[]>;
  summary: JobLifecycleSummary;
};

function ApplicantsPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "all";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [data, setData] = useState<PageData | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { user, business } = await fetchBusinessSession();
      if (cancelled) return;
      if (!business) {
        router.replace("/business/setup");
        return;
      }
      if (!user) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      const [{ data: job }, { data: apps }] = await Promise.all([
        supabase
          .from("jobs")
          .select("*")
          .eq("id", id)
          .eq("business_id", business.id)
          .maybeSingle(),
        supabase
          .from("applications")
          .select("*, profiles(*)")
          .eq("job_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!job) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      const typedJob = job as Job;

      const rows = (apps ?? []) as AppRow[];
      const accepted = rows.filter((a) => a.status === "accepted");
      const applied = rows.filter((a) => a.status === "applied");

      const jobsById = new Map([[typedJob.id, typedJob]]);
      const acceptedCountByJob = new Map([[typedJob.id, accepted.length]]);

      // Applicant identity and status are the critical content. Show them
      // before lifecycle calculations and signed attendance photos finish.
      setData({
        job: typedJob,
        rows,
        lifecycles: new Map(),
        attendanceByApp: new Map(),
        summary: summarizeJobLifecycles(
          typedJob.id,
          typedJob.headcount,
          typedJob.status,
          [],
          applied.length,
        ),
      });
      setLoading(false);

      const attendancePromise = loadAttendanceBundleByApplication(
        supabase,
        accepted.map((a) => a.id),
      );
      const [attendance, lifecycles] = await Promise.all([
        attendancePromise,
        attendancePromise.then((bundle) =>
          loadApplicationLifecycles(supabase, {
            applications: rows.map((a) => ({
              id: a.id,
              job_id: a.job_id,
              status: a.status,
            })),
            jobsById,
            actor: "business",
            actorUserId: user.id,
            acceptedCountByJob,
            events: bundle.events.filter(
              (event): event is typeof event & { application_id: string } =>
                typeof event.application_id === "string",
            ),
          }),
        ),
      ]);
      if (cancelled) return;
      const attendanceByApp = attendance.recordsByApplication;

      const summary = summarizeJobLifecycles(
        typedJob.id,
        typedJob.headcount,
        typedJob.status,
        [...lifecycles.values()],
        applied.length,
      );

      setData((current) =>
        current?.job.id === typedJob.id
          ? {
              ...current,
              lifecycles,
              attendanceByApp,
              summary,
            }
          : current,
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadVersion, router]);

  if (loading) return <PageLoading />;
  if (notFoundState || !data) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  const { job: typedJob, rows, lifecycles, attendanceByApp, summary } = data;
  const displayStatus = effectiveJobStatus(typedJob);
  const accepted = rows.filter((a) => a.status === "accepted");
  const applied = rows.filter((a) => a.status === "applied");
  const rejected = rows.filter((a) => a.status === "rejected");
  const hasAnyAttendance = attendanceByApp.size > 0;

  const filledPct = Math.min(
    100,
    Math.round((accepted.length / Math.max(typedJob.headcount, 1)) * 100),
  );
  const phoneUnlocked = isJobPhoneUnlocked(typedJob.status);

  const filtered =
    tab === "all"
      ? rows
      : tab === "accepted"
        ? accepted
        : tab === "applied"
          ? applied
          : tab === "rejected"
            ? rejected
            : rows.filter((a) => a.status === tab);

  const tabs = [
    ["all", "All", rows.length],
    ["applied", "Applied", applied.length],
    ["accepted", "Selected", accepted.length],
    ["rejected", "Rejected", rejected.length],
  ] as const;

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <PageBack href="/business/jobs" />
        <div className="flex items-center gap-0.5">
          <ReferJobButton jobId={typedJob.id} jobTitle={typedJob.title} />
          {isActiveJob(typedJob.status) ? (
            <JobActionsMenu
              jobId={typedJob.id}
              canEdit={["live", "fully_staffed", "confirmed"].includes(
                displayStatus,
              )}
            />
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl bg-primary/[0.06] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold leading-snug tracking-tight">
              {typedJob.title}
            </h1>
            <p className="mt-1 text-[15px] font-extrabold text-emerald-600">
              {formatPay(jobDayTotal(typedJob))}
              <span className="text-[12px] font-bold"> / Day</span>
              {jobWorkDates(typedJob).length > 1 ? (
                <span className="ml-1 text-[11px] font-semibold text-emerald-700/80">
                  ·{" "}
                  {formatPay(
                    jobEngagementTotal({
                      ...typedJob,
                      work_dates: jobWorkDates(typedJob),
                    }),
                  )}{" "}
                  total
                </span>
              ) : null}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
              displayStatus === "live" || displayStatus === "fully_staffed"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-muted text-muted-foreground",
            )}
          >
            {jobStatusLabel(displayStatus)}
          </span>
        </div>

        <div className="mt-3 space-y-1.5">
          <p className="flex items-center gap-2 text-[13px] font-bold text-foreground">
            <Calendar className="size-3.5 shrink-0 text-primary" />
            {formatWorkDatesLabel(jobWorkDates(typedJob))}
          </p>
          <p className="flex items-center gap-2 text-[13px] font-bold text-foreground">
            <Clock className="size-3.5 shrink-0 text-primary" />
            {formatTime(typedJob.start_time)} · {formatTime(typedJob.end_time)}
          </p>
          {typedJob.area ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground/80">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              {typedJob.area}
              {typedJob.city ? `, ${typedJob.city}` : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="size-3" />
              Need {typedJob.headcount}
            </span>
            <span className="text-foreground">
              {accepted.length}/{typedJob.headcount} filled
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${filledPct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-primary/10 pt-3">
          <JobLifecycleSummaryBar
            summary={summary}
            hideCtaHref={`/business/jobs/${id}/applicants`}
          />
        </div>

        {accepted.length > 0 ? (
          <Link
            href={`/business/jobs/${id}/attendance`}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground"
          >
            {hasAnyAttendance
              ? "View attendance records"
              : "Attendance requests"}
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <ApplicantFilterTabs jobId={id} activeTab={tab} tabs={tabs} />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            className="rounded-2xl px-6"
            title="No applicants here"
            description="Switch tabs or wait for freelancers to apply."
          />
        ) : (
          filtered.map((app) => {
            const p = app.profiles;
            const isSelected = isHiredStatus(app.status);
            const canContact = app.status === "applied" || isSelected;
            const profileHref = `/business/freelancers/${app.freelancer_id}?job=${typedJob.id}`;
            const skills =
              (p.skills || []).slice(0, 3).join(", ") ||
              p.work_type ||
              "General";
            const life = lifecycles.get(app.id);
            const records: AttendanceRecordView[] =
              attendanceByApp.get(app.id) ?? [];

            return (
              <div
                key={app.id}
                className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60"
              >
                <div className="flex items-center gap-1 pr-2">
                  <Link
                    href={profileHref}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3.5 transition-colors active:bg-muted/40"
                  >
                    <Avatar className="size-12 shrink-0 rounded-full ring-2 ring-primary/10">
                      <AvatarImage src={p.photo_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 font-bold text-primary">
                        {(p.full_name || "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-extrabold tracking-tight">
                          {p.full_name || "Freelancer"}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            applicationStatusToneClassName(app.status),
                          )}
                        >
                          {applicationStatusLabel(app.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">
                        {skills}
                        {p.city ? ` · ${p.city}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                  </Link>
                  <ReportMenuButton
                    direction="business_to_freelancer"
                    reportedUserId={app.freelancer_id}
                    reportedName={p.full_name || "Freelancer"}
                    jobId={typedJob.id}
                    applicationId={app.id}
                    applicationStatus={app.status}
                    rejectionReason={app.rejection_reason}
                    onApplicationChanged={() =>
                      setReloadVersion((version) => version + 1)
                    }
                  />
                </div>

                {life ? (
                  <div className="border-t border-border/50 px-3.5 py-3">
                    <LifecycleTracker
                      lifecycle={life}
                      showCta={
                        app.status === "accepted" ||
                        life.exception === "missed_attendance" ||
                        life.exception === "payment_dispute"
                      }
                    />
                  </div>
                ) : null}

                {records.length > 0 ? (
                  <div className="border-t border-border/50 px-3.5 py-3">
                    <p className="mb-2 text-[11px] font-extrabold tracking-tight">
                      Attendance log
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {records.map((record) => (
                        <AttendanceRecordCard key={record.id} record={record} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {canContact ? (
                  <details className="group border-t border-border/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[12px] font-bold text-primary outline-none transition-colors hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-1.5">
                        {isSelected ? (
                          <MessageSquare className="size-3.5" />
                        ) : (
                          <Phone className="size-3.5" />
                        )}
                        {isSelected ? "Contact" : "Call"}{" "}
                        {p.full_name?.split(" ")[0] || "freelancer"}
                      </span>
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <ContactActionBar
                      className="px-3.5 pb-3"
                      phone={phoneUnlocked ? p.phone : null}
                      callLocked={!phoneUnlocked}
                      chatHref={`/messages/${typedJob.id}`}
                      showChat={isSelected}
                      size="sm"
                    />
                  </details>
                ) : null}

                {life?.selectionEditable && app.status !== "accepted" ? (
                  <div className="border-t border-border/50 px-3.5 py-3">
                    <ApplicantActions
                      applicationId={app.id}
                      jobId={typedJob.id}
                      jobStatus={typedJob.status}
                      currentStatus={app.status}
                      headcount={typedJob.headcount}
                      acceptedCount={accepted.length}
                      onApplicationChanged={() =>
                        setReloadVersion((version) => version + 1)
                      }
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <SosCallout className="mt-4" />

      {accepted.length >= typedJob.headcount &&
      ["live", "fully_staffed", "confirmed"].includes(typedJob.status) ? (
        <div className="mt-6 space-y-3">
          <SuccessScreen
            title="Gig is Fully Staffed!"
            description="Great! Contact details are unlocked for selected workers."
          />
          <Link
            href="/business/jobs"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-bold"
          >
            Go to My Gigs
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function ApplicantsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApplicantsPageInner />
    </Suspense>
  );
}
