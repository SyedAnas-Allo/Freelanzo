import { Badge } from "@/components/ui/badge";
import { ListItemCard } from "@/components/shared/list-item-card";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { formatJobDate } from "@/features/jobs/formatters/job-date";
import type { BadgeVariant } from "@/lib/status";
import { formatPay } from "@/lib/utils";
import type { Job } from "@/types/database";

export function JobExperienceListItem({
  job,
  statusLabel,
  statusVariant = "success",
}: {
  job: Job;
  statusLabel: string;
  statusVariant?: BadgeVariant;
}) {
  return (
    <ListItemCard
      leading={<JobCategoryIcon category={job.category} />}
      title={job.title}
      badge={
        <Badge variant={statusVariant} size="sm" className="shrink-0">
          {statusLabel}
        </Badge>
      }
      meta={`${formatJobDate(job.job_date)} · ${formatPay(job.pay_per_freelancer)} / day`}
    />
  );
}
