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
  actionLabel = "View Details",
  footer,
}: {
  job: Job;
  businessName?: string;
  verified?: boolean;
  distanceKm?: number;
  statusLabel?: string;
  statusVariant?: BadgeVariant;
  href: string;
  actionLabel?: string;
  footer?: React.ReactNode;
}) {
  const location =
    [job.area, job.city].filter(Boolean).join(", ") || job.address;

  const body = (
    <div className="flex gap-3">
      <JobCategoryIcon category={job.category} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-[14px] font-bold leading-tight text-foreground">
                {job.title}
              </h3>
              {statusLabel ? (
                <Badge variant={statusVariant} size="sm">
                  {statusLabel}
                </Badge>
              ) : null}
            </div>

            {businessName ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-primary">
                <span className="truncate">{businessName}</span>
                {verified ? (
                  <BadgeCheck className="size-3.5 shrink-0 fill-sky-500 text-white" />
                ) : null}
              </p>
            ) : null}

            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {location}
                {distanceKm != null ? ` • ${distanceKm.toFixed(1)} km` : null}
              </span>
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-extrabold text-emerald-600">
              {formatPay(jobDayTotal(job))}
              <span className="font-semibold"> / Day</span>
            </p>
            {jobWorkDates(job).length > 1 ? (
              <p className="mt-0.5 text-[10px] font-medium text-emerald-700/75">
                {formatPay(jobEngagementTotal({ ...job, work_dates: jobWorkDates(job) }))} total
              </p>
            ) : (job.food_allowance_inr > 0 || job.travel_allowance_inr > 0) ? (
              <p className="mt-0.5 text-[10px] font-medium text-emerald-700/75">
                incl. allowances
              </p>
            ) : null}
            <p
              className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground"
              suppressHydrationWarning
            >
              <Calendar className="size-3 shrink-0" />
              {jobWorkDates(job).length > 1
                ? formatWorkDatesLabel(jobWorkDates(job))
                : formatJobDateRelative(job.job_date)}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex h-5 items-center rounded-full bg-secondary/80 px-2 text-[10px] font-medium text-secondary-foreground">
              {job.skilled ? "Skilled" : "Unskilled"}
            </span>
            <span className="inline-flex h-5 items-center rounded-full bg-secondary/80 px-2 text-[10px] font-medium text-secondary-foreground">
              {shiftLabel(job.start_time)} Shift
            </span>
          </div>
          <span className="inline-flex h-7 shrink-0 items-center rounded-lg border border-primary/30 bg-card px-2.5 text-[11px] font-semibold text-primary">
            {actionLabel}
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
