import type { Notification, UserMode } from "@/types/database";

function metaJobId(meta: Notification["meta"]): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const jobId = meta.job_id;
  return typeof jobId === "string" ? jobId : null;
}

/** Resolve where a notification should navigate when tapped. */
export function notificationHref(
  notification: Notification,
  mode: UserMode,
): string {
  const jobId = metaJobId(notification.meta);

  switch (notification.type) {
    case "application_received":
    case "application":
      return jobId
        ? `/business/jobs/${jobId}/applicants`
        : "/business/jobs";

    case "selection":
      return jobId ? `/freelancer/jobs/${jobId}` : "/freelancer/my-jobs";

    case "check_in":
    case "check_out":
    case "attendance_correction":
      return jobId
        ? mode === "business"
          ? `/business/jobs/${jobId}/attendance`
          : `/freelancer/jobs/${jobId}`
        : mode === "business"
          ? "/business"
          : "/freelancer/my-jobs";

    case "payment":
      if (!jobId) {
        return mode === "business" ? "/business" : "/freelancer/earnings";
      }
      return mode === "business"
        ? `/business/jobs/${jobId}/payment`
        : `/freelancer/jobs/${jobId}/payment`;

    case "rating":
      return "/reviews";

    default:
      if (jobId) {
        return mode === "business"
          ? `/business/jobs/${jobId}/posted`
          : `/freelancer/jobs/${jobId}`;
      }
      return mode === "business" ? "/business" : "/freelancer";
  }
}
