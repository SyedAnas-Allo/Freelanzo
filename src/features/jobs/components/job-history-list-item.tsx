import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListItemCard } from "@/components/shared/list-item-card";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import {
  effectiveJobStatus,
  jobStatusLabel,
  jobStatusVariant,
} from "@/lib/status";
import { formatPay, formatTime, jobDayTotal, jobEngagementTotal } from "@/lib/utils";
import { formatWorkDatesLabel, jobWorkDates } from "@/lib/work-dates";
import type { Job } from "@/types/database";

export function JobHistoryListItem({ job }: { job: Job }) {
  const status = effectiveJobStatus(job);
  const dates = jobWorkDates(job);
  const payout =
    job.status === "cancelled"
      ? 0
      : jobEngagementTotal({ ...job, work_dates: dates }) * job.headcount;

  return (
    <ListItemCard
      href={`/business/jobs/${job.id}/applicants`}
      leading={<JobCategoryIcon category={job.category} />}
      title={job.title}
      badge={
        <Badge
          variant={jobStatusVariant(status)}
          size="sm"
          className="shrink-0"
        >
          {jobStatusLabel(status)}
        </Badge>
      }
      description={`${formatWorkDatesLabel(dates)} · ${formatTime(job.start_time)}–${formatTime(job.end_time)}`}
      meta={`${job.area} · ${job.headcount} freelancers · ${formatPay(jobDayTotal(job))} / day`}
      trailing={
        <>
          <p
            className={
              payout === 0
                ? "text-sm font-extrabold text-destructive tabular-nums"
                : "text-sm font-extrabold text-emerald-600 tabular-nums"
            }
          >
            {formatPay(payout)}
          </p>
          <ChevronRight
            aria-hidden="true"
            className="ml-auto mt-1 size-4 text-muted-foreground"
          />
        </>
      }
    />
  );
}
