import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  MapPin,
} from "lucide-react";
import { shiftLabel } from "@/components/shift-timeline";
import { Badge } from "@/components/ui/badge";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { formatJobDateRelative } from "@/features/jobs/formatters/job-date";
import type { BadgeVariant } from "@/lib/status";
import { formatPay, jobDayTotal, jobEngagementTotal } from "@/lib/utils";
import { formatWorkDatesLabel, jobWorkDates } from "@/lib/work-dates";
import type { Job } from "@/types/database";

export function JobCard({
  job,
  businessName,
  verified,
  distanceKm,
  statusLabel,
  statusVariant = "success",
  href,
  footer,
}: {
  job: Job;
  businessName?: string;
  verified?: boolean;
  distanceKm?: number;
  statusLabel?: string;
  statusVariant?: BadgeVariant;
  href: string;
  footer?: React.ReactNode;
}) {
  const location =
    [job.area, job.city].filter(Boolean).join(", ") || job.address;
  const workDates = jobWorkDates(job);
  const multiDay = workDates.length > 1;

  const body = (
    <div className="flex gap-3">
      <JobCategoryIcon category={job.category} />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <h3 className="min-w-0 flex-1 text-pretty text-base font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
            {job.title}
          </h3>
          {statusLabel ? (
            <Badge variant={statusVariant} size="sm" className="mt-0.5 shrink-0">
              {statusLabel}
            </Badge>
          ) : null}
        </div>

        {businessName ? (
          <p className="flex items-start gap-1 text-sm font-semibold leading-snug text-primary">
            <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">
              {businessName}
            </span>
            {verified ? (
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 fill-sky-500 text-white" />
            ) : null}
          </p>
        ) : null}

        {location ? (
          <p className="flex items-start gap-1 text-xs font-medium leading-snug text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">
              {location}
              {distanceKm != null ? ` · ${distanceKm.toFixed(1)} km` : null}
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-0.5">
          <div>
            <p className="text-base font-extrabold leading-none text-emerald-600">
              {formatPay(jobDayTotal(job))}
              <span className="text-sm font-semibold"> / Day</span>
            </p>
            {multiDay ? (
              <p className="mt-0.5 text-xs font-medium text-emerald-700/75">
                {formatPay(
                  jobEngagementTotal({ ...job, work_dates: workDates }),
                )}{" "}
                total
              </p>
            ) : job.food_allowance_inr > 0 || job.travel_allowance_inr > 0 ? (
              <p className="mt-0.5 text-xs font-medium text-emerald-700/75">
                incl. allowances
              </p>
            ) : null}
          </div>
          <p
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
            suppressHydrationWarning
          >
            <Calendar className="size-3.5 shrink-0" />
            {multiDay
              ? formatWorkDatesLabel(workDates)
              : formatJobDateRelative(job.job_date)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full bg-secondary/80 px-2.5 text-xs font-medium text-secondary-foreground">
            {job.skilled ? "Skilled" : "Unskilled"}
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-secondary/80 px-2.5 text-xs font-medium text-secondary-foreground">
            {shiftLabel(job.start_time)} Shift
          </span>
        </div>
      </div>
    </div>
  );

  if (footer) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Link
          href={href}
          className="block p-3.5 transition-colors hover:bg-muted/20 active:bg-muted/30"
        >
          {body}
        </Link>
        <div className="border-t border-border/50 px-3.5 py-2.5">{footer}</div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/70 bg-card p-3.5 transition-colors hover:border-primary/25 hover:bg-muted/20 active:bg-muted/30"
    >
      {body}
    </Link>
  );
}
