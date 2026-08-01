import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { jobStatusLabel, jobStatusVariant } from "@/lib/status";
import {
  formatPay,
  formatTime,
  jobDayTotal,
  jobEngagementTotal,
} from "@/lib/utils";
import { formatWorkDatesLabel, jobWorkDates } from "@/lib/work-dates";
import type { Job } from "@/types/database";

export function JobHeroCard({
  job,
  className,
  statusOverride,
  workDate,
}: {
  job: Job;
  className?: string;
  statusOverride?: string;
  /** Highlight a specific attendance day when set. */
  workDate?: string;
}) {
  const status = statusOverride ?? jobStatusLabel(job.status);
  const dates = jobWorkDates(job);
  const multi = dates.length > 1;
  return (
    <Surface className={className}>
      <div className="flex items-start gap-3">
        <JobCategoryIcon category={job.category} className="size-12" iconClassName="size-6" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-extrabold leading-tight">{job.title}</h2>
            <Badge
              variant={jobStatusVariant(job.status)}
              size="sm"
              className="shrink-0 capitalize"
            >
              {status}
            </Badge>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-xs font-light text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-primary" />
              {workDate
                ? formatWorkDatesLabel([workDate])
                : formatWorkDatesLabel(dates)}
            </li>
            <li className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-primary" />
              {formatTime(job.start_time)} – {formatTime(job.end_time)}
              {multi ? (
                <span className="text-[10px] font-medium">each day</span>
              ) : null}
            </li>
            <li className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">
                {[job.area, job.city].filter(Boolean).join(", ") || job.address}
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <Users className="size-3.5 shrink-0 text-primary" />
              {`${job.headcount} Freelancer${job.headcount === 1 ? "" : "s"}`}
            </li>
          </ul>
          <p className="mt-2.5 text-sm font-extrabold text-emerald-600">
            {formatPay(jobDayTotal(job))}
            <span className="text-[11px] font-medium text-emerald-600/70">
              {" "}
              / Day
            </span>
            {multi ? (
              <span className="ml-1 text-[11px] font-semibold text-emerald-700/80">
                · {formatPay(jobEngagementTotal({ ...job, work_dates: dates }))}{" "}
                total
              </span>
            ) : null}
          </p>
          {multi ? (
            <p className="mt-1 text-[10px] font-medium text-muted-foreground">
              Check in & out each day · Pay once at the end
            </p>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
