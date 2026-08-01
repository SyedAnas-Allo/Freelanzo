import { ChevronRight, MapPin } from "lucide-react";
import { ListItemCard } from "@/components/shared/list-item-card";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { shiftLabel } from "@/components/shift-timeline";
import { formatWorkDatesLabel, jobWorkDates } from "@/lib/work-dates";
import type { Job } from "@/types/database";

export function BusinessJobListItem({
  job,
  applicantCount,
  href,
}: {
  job: Job;
  applicantCount: number;
  href: string;
}) {
  return (
    <ListItemCard
      href={href}
      leading={<JobCategoryIcon category={job.category} />}
      title={job.title}
      description={`${formatWorkDatesLabel(jobWorkDates(job))} · ${shiftLabel(job.start_time)} shift`}
      meta={
        <span className="flex items-center gap-1">
          <MapPin aria-hidden="true" className="size-3 shrink-0 text-primary" />
          <span className="truncate">{job.area || job.city}</span>
        </span>
      }
      trailing={
        <div className="flex items-center gap-1">
          <div>
            <p className="text-sm font-extrabold text-primary tabular-nums">
              {applicantCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Applicants</p>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </div>
      }
    />
  );
}
