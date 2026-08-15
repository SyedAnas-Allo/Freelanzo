import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import { isJobScheduleOpen, jobWorkDates } from "@/lib/work-dates";
import type { ApplicationStatus, Job, JobStatus } from "@/types/database";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "applied",
  "accepted",
  "rejected",
  "cancelled",
];

export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  "live",
  "fully_staffed",
  "confirmed",
  "in_progress",
];

export const SELECTION_OPEN_STATUSES: JobStatus[] = [
  "live",
  "fully_staffed",
  "confirmed",
];

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "accepted":
      return "Selected";
    case "rejected":
      return "Rejected";
    case "applied":
      return "Applied";
    case "cancelled":
      return "Withdrawn";
    default:
      return status;
  }
}

export function isHiredStatus(status: ApplicationStatus): boolean {
  return status === "accepted";
}

export function applicationStatusVariant(
  status: ApplicationStatus,
): BadgeVariant {
  switch (status) {
    case "accepted":
      return "success";
    case "rejected":
      return "destructive";
    case "applied":
      return "secondary";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

/** Freelancer-facing label for an application, reflecting job lifecycle. */
export function freelancerJobStatusLabel(
  applicationStatus: ApplicationStatus,
  jobStatus: JobStatus,
): string {
  if (applicationStatus !== "accepted") {
    return applicationStatusLabel(applicationStatus);
  }
  if (jobStatus === "completed") return "Completed";
  if (jobStatus === "cancelled") return "Cancelled";
  if (jobStatus === "expired") return "Expired";
  if (jobStatus === "in_progress") return "In progress";
  return "Selected";
}

export function freelancerJobStatusVariant(
  applicationStatus: ApplicationStatus,
  jobStatus: JobStatus,
): BadgeVariant {
  if (applicationStatus !== "accepted") {
    return applicationStatusVariant(applicationStatus);
  }
  if (jobStatus === "cancelled") return "destructive";
  if (jobStatus === "expired") return "secondary";
  return "success";
}

export function isAcceptedSelectedWork(
  applicationStatus: ApplicationStatus,
  jobStatus: JobStatus,
): boolean {
  return (
    applicationStatus === "accepted" &&
    jobStatus !== "completed" &&
    jobStatus !== "cancelled" &&
    jobStatus !== "expired"
  );
}

export function isAcceptedCompletedWork(
  applicationStatus: ApplicationStatus,
  jobStatus: JobStatus,
): boolean {
  return applicationStatus === "accepted" && jobStatus === "completed";
}

/** Phone unlocks after accept; locks again when gig chat would close. */
export function isJobPhoneUnlocked(jobStatus: JobStatus): boolean {
  return (
    jobStatus !== "completed" &&
    jobStatus !== "cancelled" &&
    jobStatus !== "expired"
  );
}

export function applicationStatusToneClassName(
  status: ApplicationStatus,
): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-red-100 text-red-600";
    case "applied":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function jobStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "live":
      return "success";
    case "fully_staffed":
      return "info";
    case "confirmed":
    case "in_progress":
      return "success";
    case "completed":
      return "success";
    case "cancelled":
      return "destructive";
    case "draft":
      return "outline";
    case "expired":
      return "secondary";
    default:
      return "secondary";
  }
}

export function jobStatusLabel(status: string): string {
  switch (status) {
    case "live":
      return "Live";
    case "fully_staffed":
      return "Fully staffed";
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    case "expired":
      return "Expired";
    default:
      return status.replaceAll("_", " ");
  }
}

export function isSelectionOpen(status: JobStatus): boolean {
  return SELECTION_OPEN_STATUSES.includes(status);
}

type JobScheduleFields = Pick<
  Job,
  "status" | "job_date" | "work_dates" | "start_time" | "end_time"
>;

/**
 * Status as freelancers actually experience it. A live gig whose shift has
 * ended is no longer listed to anyone, but the row stays `live` because
 * `private.expire_finished_jobs` has nothing scheduled to run it.
 */
export function effectiveJobStatus(job: JobScheduleFields): JobStatus {
  if (job.status !== "live") return job.status;
  return isJobScheduleOpen(jobWorkDates(job), job.start_time, job.end_time)
    ? "live"
    : "expired";
}

export function isActiveJob(status: JobStatus): boolean {
  return ACTIVE_JOB_STATUSES.includes(status);
}
