import { Wallet } from "lucide-react";
import { ListItemCard } from "@/components/shared/list-item-card";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { formatJobDate } from "@/features/jobs/formatters/job-date";
import { formatPay } from "@/lib/utils";
import type { Job } from "@/types/database";

export function EarningsTransactionListItem({
  job,
  amount,
}: {
  job?: Job;
  amount: number;
}) {
  return (
    <ListItemCard
      href={job ? `/freelancer/jobs/${job.id}` : "/freelancer/my-jobs"}
      leading={
        job ? (
          <JobCategoryIcon category={job.category} />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Wallet aria-hidden="true" className="size-5" />
          </span>
        )
      }
      title={job?.title || "Gig Payment"}
      meta={job ? formatJobDate(job.job_date) : "Gig details unavailable"}
      trailing={
        <p className="text-sm font-extrabold text-emerald-600 tabular-nums">
          +{formatPay(amount)}
        </p>
      }
    />
  );
}
