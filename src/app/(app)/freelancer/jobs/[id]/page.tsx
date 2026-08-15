"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  Bus,
  Calendar,
  Clock,
  MapPin,
  Shirt,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { ContactActionBar } from "@/components/actions/contact-action-bar";
import { ApplicationActionsMenu } from "@/components/application-actions-menu";
import {
  AttendanceRecordCard,
  type AttendanceRecordView,
} from "@/components/attendance-record-card";
import { ExpandableText } from "@/components/expandable-text";
import { InfoCallout } from "@/components/info-callout";
import { JobDetailFooter } from "@/components/job-detail-footer";
import { LifecycleTracker } from "@/components/lifecycle-tracker";
import { PageBack } from "@/components/page-back";
import { PageLoading } from "@/components/page-loading";
import { PaymentResponsibilityCallout } from "@/components/payment-responsibility-callout";
import { ReferJobButton } from "@/components/refer-button";
import { SaveJobButton } from "@/components/save-job-button";
import { shiftLabel } from "@/components/shift-timeline";
import { SosCallout } from "@/components/sos-callout";
import { MetaPill } from "@/components/ui/meta-pill";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { formatJobDateRelative, jobTimingTag } from "@/features/jobs/formatters/job-date";
import {
  deriveApplicationLifecycle,
  type ApplicationLifecycle,
} from "@/lib/application-lifecycle";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { loadAttendanceBundleForApplication } from "@/lib/load-attendance-records";
import { canApplyOrReapply } from "@/lib/job-footer-action";
import { checkJobEligibility } from "@/lib/profile-eligibility";
import { createClient } from "@/lib/supabase/client";
import { isHiredStatus, isJobPhoneUnlocked } from "@/lib/status";
import {
  cn,
  formatJobPay,
  formatPay,
  formatTime,
  haversineKm,
  jobDayTotal,
  jobEngagementTotal,
} from "@/lib/utils";
import {
  formatWorkDatesLabel,
  formatWorkDatesList,
  jobWorkDates,
} from "@/lib/work-dates";
import type { Application, Job, Profile } from "@/types/database";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-[13px] font-bold leading-snug text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-2 py-1 text-center", className)}>
      <span className="mx-auto flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <p className="mt-1.5 text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] font-extrabold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

type JobWithBusiness = Job & {
  business_profiles: {
    owner_id: string;
    business_name: string;
    verified: boolean;
    description: string | null;
    address: string | null;
    created_at: string;
  };
};

type PageData = {
  profile: Profile | null;
  userId: string;
  job: JobWithBusiness;
  application: Application | null;
  saved: boolean;
  acceptedCount: number;
  acceptingApplications: boolean;
  jobsPostedCount: number;
  businessPhone: string | null;
  lifecycle: ApplicationLifecycle | null;
  attendanceRecords: AttendanceRecordView[];
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [data, setData] = useState<PageData | null>(null);
  // This screen loads its own data on the client, so router.refresh() cannot
  // pick up a withdrawal. Bumping this re-runs the loader.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      const session = await fetchSessionProfile();
      if (!session.user) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      const [
        { data: job },
        { data: application },
        { data: savedJob },
        { count: acceptedCount },
        { data: availableRows },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select("*, business_profiles(*)")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("applications")
          .select("*")
          .eq("job_id", id)
          .eq("freelancer_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("saved_jobs")
          .select("job_id")
          .eq("job_id", id)
          .eq("freelancer_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("job_id", id)
          .eq("status", "accepted"),
        supabase.rpc("available_job_ids", { p_job_id: id }),
      ]);

      if (!job) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      const typedJob = job as JobWithBusiness;
      const typedApp = application as Application | null;
      const hired = typedApp ? isHiredStatus(typedApp.status) : false;
      const acceptingApplications =
        ((availableRows ?? []) as { job_id: string }[]).length > 0;
      const jobsPostedCountPromise = supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("business_id", typedJob.business_id);

      let businessPhone: string | null = null;
      let lifecycle: ApplicationLifecycle | null = null;
      let attendanceRecords: AttendanceRecordView[] = [];

      if (typedApp) {
        const [{ data: pay }, { data: rating }, attendance, { data: ownerProfile }] =
          await Promise.all([
            supabase
              .from("payments")
              .select("status, business_claimed, freelancer_claimed")
              .eq("application_id", typedApp.id)
              .maybeSingle(),
            supabase
              .from("ratings")
              .select("id")
              .eq("application_id", typedApp.id)
              .eq("from_user_id", session.user.id)
              .maybeSingle(),
            loadAttendanceBundleForApplication(supabase, typedApp.id, {
              includeRecords: hired,
            }),
            hired && isJobPhoneUnlocked(typedJob.status)
              ? supabase
                  .from("profiles")
                  .select("phone")
                  .eq("id", typedJob.business_profiles.owner_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        lifecycle = deriveApplicationLifecycle({
          applicationId: typedApp.id,
          jobId: typedJob.id,
          applicationStatus: typedApp.status,
          jobStatus: typedJob.status,
          workDates: jobWorkDates(typedJob),
          events: attendance.events,
          paymentStatus:
            (pay?.status as "pending" | "confirmed" | "dispute") ?? null,
          businessClaimed: !!pay?.business_claimed,
          freelancerClaimed: !!pay?.freelancer_claimed,
          ratedByActor: !!rating,
          headcount: typedJob.headcount,
          acceptedCount: acceptedCount ?? 0,
          actor: "freelancer",
        });

        if (hired) {
          attendanceRecords = attendance.records;
          businessPhone = ownerProfile?.phone ?? null;
        }
      }

      const { count: jobsPostedCount } = await jobsPostedCountPromise;
      setData({
        profile: session.profile,
        userId: session.user.id,
        job: typedJob,
        application: typedApp,
        saved: !!savedJob,
        acceptedCount: acceptedCount ?? 0,
        acceptingApplications,
        jobsPostedCount: jobsPostedCount ?? 0,
        businessPhone,
        lifecycle,
        attendanceRecords,
      });
      setLoading(false);
    }
    void load();
  }, [id, router, reloadKey]);

  if (loading) return <PageLoading />;
  if (notFoundState || !data) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  const {
    profile,
    userId,
    job: typedJob,
    application: typedApp,
    saved,
    acceptedCount,
    acceptingApplications,
    jobsPostedCount,
    businessPhone,
    lifecycle,
    attendanceRecords,
  } = data;
  const hired = typedApp ? isHiredStatus(typedApp.status) : false;

  const distance =
    profile?.lat !== null &&
    profile?.lat !== undefined &&
    profile.lng !== null &&
    profile.lng !== undefined
      ? haversineKm(profile.lat, profile.lng, typedJob.lat, typedJob.lng)
      : null;

  const requirements = (typedJob.instructions || "")
    .split(/\n|•|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  const memberSince = new Date(
    typedJob.business_profiles.created_at,
  ).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  const locationLabel =
    [typedJob.area, typedJob.city].filter(Boolean).join(", ") ||
    typedJob.address;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${typedJob.lat},${typedJob.lng}`;
  const dates = jobWorkDates(typedJob);
  const multiDay = dates.length > 1;
  const timingTag = jobTimingTag(dates);

  const detailRows = [
    {
      icon: Users,
      label: "No. of openings",
      value: String(typedJob.headcount),
    },
    {
      icon: Briefcase,
      label: "Accepted",
      value: `${acceptedCount}/${typedJob.headcount}`,
    },
    ...(typedJob.dress_code
      ? [
          {
            icon: Shirt,
            label: "Dress code",
            value: typedJob.dress_code,
          },
        ]
      : []),
    {
      icon: UtensilsCrossed,
      label: "Food allowance",
      value:
        typedJob.food_allowance_inr > 0
          ? `${formatPay(typedJob.food_allowance_inr)} / day`
          : "Not included",
    },
    {
      icon: Bus,
      label: "Travel allowance",
      value:
        typedJob.travel_allowance_inr > 0
          ? `${formatPay(typedJob.travel_allowance_inr)} / day`
          : "Not included",
    },
  ];

  const rawCta = lifecycle?.cta ?? null;
  const scheduledCheckInDate =
    hired &&
    !lifecycle?.attendanceComplete &&
    lifecycle?.attendance.actionable === null
      ? (lifecycle.attendance.days.find((day) => day.phase === "scheduled")
          ?.date ?? null)
      : null;
  const footerCta =
    !rawCta ||
    rawCta.kind === "waiting" ||
    rawCta.kind === "done" ||
    rawCta.href === `/freelancer/jobs/${typedJob.id}`
      ? null
      : rawCta;
  const canWithdraw =
    typedApp?.status === "applied" || typedApp?.status === "accepted";
  const canReportBusiness =
    !!typedApp &&
    (typedApp.status === "applied" || typedApp.status === "accepted") &&
    !!typedJob.business_profiles.owner_id;
  const canApply = canApplyOrReapply(typedApp?.status);
  const showFooter = canApply || !!footerCta || !!scheduledCheckInDate;

  const editProfileHref = `/profile/edit?returnTo=${encodeURIComponent(`/freelancer/jobs/${typedJob.id}`)}`;
  const setupHref = `/onboarding?returnTo=${encodeURIComponent(`/freelancer/jobs/${typedJob.id}`)}`;
  const eligibility = profile
    ? checkJobEligibility(profile, typedJob, { editProfileHref, setupHref })
    : { ok: true as const };
  const eligibilityBlock = eligibility.ok ? null : eligibility;

  const footerPadClass =
    eligibilityBlock && canApply
      ? "pb-[calc(14rem+env(safe-area-inset-bottom,0px))]"
      : showFooter
        ? "pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))]"
        : undefined;

  return (
    <div className={cn("px-4 pt-1", footerPadClass)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <PageBack href="/freelancer" />
        <div className="flex items-center gap-1">
          <SaveJobButton
            jobId={typedJob.id}
            userId={userId}
            initialSaved={saved}
            className="shadow-none"
          />
          <ReferJobButton jobId={typedJob.id} jobTitle={typedJob.title} />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <JobCategoryIcon
          category={typedJob.category}
          className="size-12 rounded-xl"
          iconClassName="size-5"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-pretty text-[17px] font-extrabold leading-snug tracking-tight [overflow-wrap:anywhere]">
            {typedJob.title}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-[13px] font-bold text-primary">
            <Link
              href={`/freelancer/businesses/${typedJob.business_id}?job=${typedJob.id}&from=${encodeURIComponent(`/freelancer/jobs/${typedJob.id}`)}`}
              className="min-w-0 text-pretty [overflow-wrap:anywhere]"
            >
              {typedJob.business_profiles.business_name}
            </Link>
            {typedJob.business_profiles.verified ? (
              <BadgeCheck
                aria-label="Verified business"
                className="size-3.5 shrink-0 fill-sky-500 text-white"
              />
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="inline-flex max-w-full flex-col gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 ring-1 ring-primary/20">
          <p
            className="flex items-center gap-1.5 text-[12px] font-extrabold leading-none text-primary"
            suppressHydrationWarning
          >
            <Calendar className="size-3.5 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {multiDay
                ? formatWorkDatesLabel(dates)
                : formatJobDateRelative(typedJob.job_date)}
            </span>
          </p>
          <p className="flex items-center gap-1.5 text-[12px] font-extrabold leading-none text-primary">
            <Clock className="size-3.5 shrink-0" />
            {formatTime(typedJob.start_time)} – {formatTime(typedJob.end_time)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-extrabold leading-tight text-emerald-600 tabular-nums">
            {formatPay(jobDayTotal(typedJob))}
            <span className="text-[11px] font-bold"> / Day</span>
          </p>
          {multiDay ? (
            <p className="mt-0.5 text-[10px] font-semibold text-emerald-700/80">
              {formatPay(
                jobEngagementTotal({
                  ...typedJob,
                  work_dates: dates,
                }),
              )}{" "}
              total · paid once
            </p>
          ) : typedJob.food_allowance_inr > 0 ||
            typedJob.travel_allowance_inr > 0 ? (
            <p className="mt-0.5 text-[10px] font-medium leading-snug text-emerald-700/80">
              {formatJobPay(typedJob)}
            </p>
          ) : null}
        </div>
      </div>

      {multiDay ? (
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-muted-foreground">
          Work days: {formatWorkDatesList(dates)}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">
            {locationLabel}
            {distance !== null ? (
              <span className="font-semibold text-foreground/80">
                {" "}
                · {distance.toFixed(1)} km
              </span>
            ) : null}
          </span>
        </p>
        <a
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/35 px-2.5 py-1 text-[11px] font-bold text-primary"
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin className="size-3" />
          View on Map
        </a>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {timingTag ? (
          <MetaPill
            tone="amber"
            className="h-5 px-2 text-[11px]"
            suppressHydrationWarning
          >
            {timingTag}
          </MetaPill>
        ) : null}
        <MetaPill tone="violet" className="h-5 px-2 text-[11px]">
          {typedJob.skilled ? "Skilled" : "Unskilled"}
        </MetaPill>
        <MetaPill tone="violet" className="h-5 px-2 text-[11px]">
          {shiftLabel(typedJob.start_time)} Shift
        </MetaPill>
        <MetaPill tone="violet" className="h-5 px-2 text-[11px]">
          {typedJob.gender_preference === "any"
            ? "Any gender"
            : typedJob.gender_preference === "male"
              ? "Male"
              : "Female"}
        </MetaPill>
      </div>

      {typedApp && lifecycle ? (
        <section className="mt-4 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-extrabold tracking-tight">
              {hired ? "Your progress" : "Application status"}
            </h2>
            {canWithdraw || canReportBusiness ? (
              <ApplicationActionsMenu
                applicationId={typedApp.id}
                canWithdraw={canWithdraw}
                onWithdrawn={() => setReloadKey((key) => key + 1)}
                report={
                  canReportBusiness
                    ? {
                        reportedUserId: typedJob.business_profiles.owner_id,
                        reportedName:
                          typedJob.business_profiles.business_name || "Business",
                        jobId: typedJob.id,
                      }
                    : null
                }
              />
            ) : null}
          </div>
          {hired ? (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="size-3.5 text-primary" />
                {formatTime(typedJob.start_time)} –{" "}
                {formatTime(typedJob.end_time)}
                {multiDay ? " · each work day" : ""}
              </p>
              {multiDay ? (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {lifecycle.attendance.checkOutDone}/
                  {lifecycle.attendance.totalDays} days complete · Check in & out
                  daily · Pay once at the end
                </p>
              ) : null}
            </>
          ) : null}
          <div className="mt-3 rounded-xl border border-border/70 bg-card p-3.5">
            <LifecycleTracker lifecycle={lifecycle} showCta={false} />
          </div>
          {hired &&
          !lifecycle.attendanceComplete &&
          lifecycle.attendance.actionable?.reason === "today" ? (
            <InfoCallout className="mt-2.5" title="Attendance confirmation">
              <p>
                When you are on site, capture a live photo and send an
                attendance request. The business will confirm it
                {multiDay ? " for that day" : ""}.
              </p>
            </InfoCallout>
          ) : null}
          {hired && attendanceRecords.length > 0 ? (
            <div className="mt-3 space-y-2">
              <h3 className="text-[12px] font-extrabold tracking-tight">
                Attendance log
              </h3>
              <p className="text-[11px] font-light text-muted-foreground">
                Time and GPS recorded at each check-in and check-out.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {attendanceRecords.map((record) => (
                  <AttendanceRecordCard key={record.id} record={record} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-5 border-t border-border/60 pt-4">
        <h2 className="text-[13px] font-extrabold tracking-tight">
          Gig Description
        </h2>
        <div className="mt-1.5">
          <ExpandableText
            text={typedJob.description || "No description provided."}
          />
        </div>
      </section>

      {(requirements.length > 0 || detailRows.length > 0) && (
        <section className="mt-4 border-t border-border/60 pt-4">
          <h2 className="text-[13px] font-extrabold tracking-tight">
            Gig Requirements
          </h2>
          {requirements.length > 0 ? (
            <ul className="mt-2.5 space-y-2">
              {requirements.map((req) => (
                <li key={req} className="flex gap-2 text-[13px]">
                  <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BadgeCheck className="size-3" />
                  </span>
                  <span className="font-medium leading-snug text-foreground/90">
                    {req}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 divide-y divide-border/60 rounded-xl bg-primary/[0.04] px-3">
            {detailRows.map((row) => (
              <DetailRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                value={row.value}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 border-t border-border/60 pt-4">
        <h2 className="text-[13px] font-extrabold tracking-tight">
          Pay & Benefits
        </h2>
        <p className="mt-1.5 text-lg font-extrabold leading-none text-emerald-600">
          {formatPay(jobDayTotal(typedJob))}
          <span className="text-sm font-bold"> / Day</span>
        </p>
        {multiDay ? (
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            {formatPay(
              jobEngagementTotal({ ...typedJob, work_dates: dates }),
            )}{" "}
            total for {dates.length} days · paid once at the end
          </p>
        ) : null}
        {(typedJob.food_allowance_inr > 0 ||
          typedJob.travel_allowance_inr > 0) && (
          <p className="mt-1 text-xs font-semibold text-foreground/80">
            {formatPay(typedJob.pay_per_freelancer)} base
            {typedJob.food_allowance_inr > 0
              ? ` + ${formatPay(typedJob.food_allowance_inr)} food`
              : ""}
            {typedJob.travel_allowance_inr > 0
              ? ` + ${formatPay(typedJob.travel_allowance_inr)} travel`
              : ""}
          </p>
        )}
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Cash / UPI after {multiDay ? "all work days" : "gig completion"}
        </p>
        <PaymentResponsibilityCallout className="mt-3" />
      </section>

      {hired ? <SosCallout className="mt-4" /> : null}

      <section className="mt-4 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-extrabold tracking-tight">
            About the Business
          </h2>
          <Link
            href={`/freelancer/businesses/${typedJob.business_id}?job=${typedJob.id}&from=${encodeURIComponent(`/freelancer/jobs/${typedJob.id}`)}`}
            className="text-xs font-bold text-primary"
          >
            View profile
          </Link>
        </div>
        <Link
          href={`/freelancer/businesses/${typedJob.business_id}?job=${typedJob.id}&from=${encodeURIComponent(`/freelancer/jobs/${typedJob.id}`)}`}
          className="mt-1 block text-[13px] font-bold text-primary"
        >
          {typedJob.business_profiles.business_name}
        </Link>
        {typedJob.business_profiles.description ? (
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted-foreground">
            {typedJob.business_profiles.description}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 divide-x divide-border/70 rounded-xl bg-primary/[0.04] py-2.5">
          <StatCell icon={Users} label="Member since" value={memberSince} />
          <StatCell
            icon={Briefcase}
            label="Gigs Posted"
            value={String(jobsPostedCount)}
          />
        </div>

        {typedJob.business_profiles.address ? (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {typedJob.business_profiles.address}
          </p>
        ) : null}
      </section>

      {hired ? (
        <section className="mt-4 border-t border-border/60 pt-4">
          <h2 className="text-[13px] font-extrabold tracking-tight">
            Contact Business
          </h2>
          <ContactActionBar
            className="mt-2.5"
            phone={businessPhone}
            callLocked={!isJobPhoneUnlocked(typedJob.status)}
            chatHref={`/messages/${typedJob.id}`}
            layout="stack"
            size="sm"
          />
        </section>
      ) : null}

      {showFooter ? (
        <JobDetailFooter
          footerCta={footerCta}
          hired={hired}
          jobId={typedJob.id}
          applicationId={typedApp?.id ?? null}
          applicationStatus={typedApp?.status ?? null}
          closed={!acceptingApplications}
          mapsUrl={mapsUrl}
          scheduledCheckInDate={scheduledCheckInDate}
          eligibilityBlock={canApply ? eligibilityBlock : null}
          jobRequirements={{
            gender_preference: typedJob.gender_preference,
            skilled: typedJob.skilled,
          }}
        />
      ) : null}
    </div>
  );
}
