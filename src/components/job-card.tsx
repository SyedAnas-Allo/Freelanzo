import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  ChevronRight,
  Clock,
  Flame,
  MapPin,
} from "lucide-react";
import { shiftLabel } from "@/components/shift-timeline";
import { Badge } from "@/components/ui/badge";
import { MetaPill } from "@/components/ui/meta-pill";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import {
  formatJobDate,
  jobTimingTag,
} from "@/features/jobs/formatters/job-date";
import type { BadgeVariant } from "@/lib/status";
import {
  CATEGORIES,
  formatPay,
  formatTime,
  jobDayTotal,
  jobEngagementTotal,
} from "@/lib/utils";
import {
  formatWorkDatesLabel,
  jobWorkDates,
  parseLocalDate,
} from "@/lib/work-dates";
import type { Job } from "@/types/database";

const URGENT_WINDOW_MS = 72 * 60 * 60 * 1000;

export function isJobUrgent(job: Pick<Job, "created_at">) {
  const created = new Date(job.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= URGENT_WINDOW_MS;
}

function formatCardDates(workDates: string[]) {
  if (workDates.length === 0) return "—";
  if (workDates.length === 1) return formatJobDate(workDates[0]!);

  const first = parseLocalDate(workDates[0]!);
  const last = parseLocalDate(workDates[workDates.length - 1]!);
  const sameMonthYear =
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear();

  if (sameMonthYear) {
    const end = last.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${first.getDate()} – ${end}`;
  }

  const start = first.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const end = last.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function categoryLabel(category: Job["category"]) {
  return CATEGORIES.find((cat) => cat.value === category)?.label ?? category;
}

export function JobCard({
  job,
  businessName,
  verified,
  distanceKm,
  statusLabel,
  statusVariant = "success",
  href,
  footer,
  urgent,
}: {
  job: Job;
  businessName?: string;
  verified?: boolean;
  distanceKm?: number;
  statusLabel?: string;
  statusVariant?: BadgeVariant;
  href: string;
  footer?: React.ReactNode;
  urgent?: boolean;
}) {
  const location =
    [job.area, job.city].filter(Boolean).join(", ") || job.address;
  const workDates = jobWorkDates(job);
  const multiDay = workDates.length > 1;
  const showUrgent = !statusLabel && (urgent ?? isJobUrgent(job));
  const dayCount = workDates.length;
  const timingTag = jobTimingTag(workDates);
  const shiftName = `${shiftLabel(job.start_time)} Shift`;
  const shiftHours = `${formatTime(job.start_time)} – ${formatTime(job.end_time)}`;

  const body = (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2.5">
        <JobCategoryIcon
          category={job.category}
          className="size-10"
          iconClassName="size-4"
        />

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-pretty text-sm font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
              {job.title}
            </h3>
            {statusLabel ? (
              <Badge
                variant={statusVariant}
                size="sm"
                className="mt-0.5 shrink-0"
              >
                {statusLabel}
              </Badge>
            ) : showUrgent ? (
              <span
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700"
                suppressHydrationWarning
              >
                <Flame className="size-2.5 fill-violet-600 text-violet-600" />
                Urgently hiring
              </span>
            ) : null}
          </div>

          {businessName ? (
            <p className="flex items-start gap-1 text-[13px] font-semibold leading-snug text-primary">
              <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">
                {businessName}
              </span>
              {verified ? (
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 fill-sky-500 text-white" />
              ) : null}
            </p>
          ) : null}

          {location ? (
            <p className="flex items-start gap-1 text-[11px] font-medium leading-snug text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" />
              <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">
                {location}
                {distanceKm != null ? ` · ${distanceKm.toFixed(1)} km` : null}
              </span>
            </p>
          ) : null}
        </div>

        <ChevronRight
          aria-hidden
          className="mt-1 size-4 shrink-0 text-primary"
        />
      </div>

      <div className="grid grid-cols-3 gap-0 border-y border-dashed border-border/70 py-2">
        <div className="min-w-0 pr-2">
          <p className="text-[13px] font-extrabold leading-tight text-emerald-600">
            {formatPay(jobDayTotal(job))}
            <span className="text-[11px] font-semibold"> / Day</span>
          </p>
          {multiDay ? (
            <p className="mt-0.5 text-[10px] font-medium text-emerald-700/75">
              {formatPay(jobEngagementTotal({ ...job, work_dates: workDates }))}{" "}
              total
            </p>
          ) : job.food_allowance_inr > 0 || job.travel_allowance_inr > 0 ? (
            <p className="mt-0.5 text-[10px] font-medium text-emerald-700/75">
              incl. allowances
            </p>
          ) : null}
        </div>

        <div className="min-w-0 border-x border-border/60 px-2">
          <p
            className="flex items-start gap-1 text-[11px] font-semibold leading-snug text-muted-foreground"
            suppressHydrationWarning
            title={
              multiDay
                ? formatWorkDatesLabel(workDates)
                : formatJobDate(job.job_date)
            }
          >
            <Calendar className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {formatCardDates(workDates)}
            </span>
          </p>
          <p className="mt-0.5 pl-4 text-[10px] font-medium text-muted-foreground">
            {dayCount} {dayCount === 1 ? "day" : "days"}
          </p>
        </div>

        <div className="min-w-0 pl-2">
          <p className="flex items-start gap-1 text-[11px] font-semibold leading-snug text-muted-foreground">
            <Clock className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{shiftName}</span>
          </p>
          <p className="mt-0.5 pl-4 text-[10px] font-medium leading-snug text-muted-foreground">
            {shiftHours}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
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
          {job.skilled ? "Skilled" : "Unskilled"}
        </MetaPill>
        <MetaPill tone="violet" className="h-5 px-2 text-[11px]">
          {categoryLabel(job.category)}
        </MetaPill>
        <MetaPill tone="violet" className="h-5 px-2 text-[11px]">
          {job.gender_preference === "any"
            ? "Any gender"
            : job.gender_preference === "male"
              ? "Male"
              : "Female"}
        </MetaPill>
      </div>
    </div>
  );

  if (footer) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm shadow-black/[0.03]">
        <Link
          href={href}
          className="block p-3 transition-colors hover:bg-muted/20 active:bg-muted/30"
        >
          {body}
        </Link>
        <div className="border-t border-border/50 px-3 py-2.5">{footer}</div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/70 bg-card p-3 shadow-sm shadow-black/[0.03] transition-colors hover:border-primary/25 hover:bg-muted/20 active:bg-muted/30"
    >
      {body}
    </Link>
  );
}
