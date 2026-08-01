/**
 * Simple reliability score 0–100 from attendance, completion, ratings,
 * and withdrawals (cancelled applications).
 */
export function computeReliabilityScore({
  acceptedJobs,
  checkedIn,
  completedCheckouts,
  cancelled,
  avgRating,
}: {
  acceptedJobs: number;
  checkedIn: number;
  completedCheckouts: number;
  cancelled: number;
  avgRating: number | null;
}) {
  const hasHistory =
    acceptedJobs > 0 ||
    cancelled > 0 ||
    (avgRating != null && avgRating > 0);

  if (!hasHistory) {
    return 80; // new-user baseline
  }

  const attendanceRate =
    acceptedJobs > 0 ? checkedIn / acceptedJobs : 0.8;
  const completionRate =
    acceptedJobs > 0 ? completedCheckouts / acceptedJobs : 0.8;
  // Withdrawals always hurt, including before any job is accepted.
  const cancelDenom = acceptedJobs + cancelled;
  const cancelPenalty =
    cancelDenom > 0 ? Math.min(1, cancelled / cancelDenom) : 0;
  const ratingFactor = avgRating != null ? avgRating / 5 : 0.8;

  const raw =
    attendanceRate * 35 +
    completionRate * 30 +
    ratingFactor * 25 +
    (1 - cancelPenalty) * 10;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Business trust score 0–100 — freelancers care about getting paid,
 * gigs finishing as posted, and fair ratings.
 */
export function computeBusinessTrustScore({
  jobsPosted,
  jobsCompleted,
  jobsCancelled,
  paymentsTracked,
  paymentsConfirmed,
  avgRating,
}: {
  jobsPosted: number;
  jobsCompleted: number;
  jobsCancelled: number;
  paymentsTracked: number;
  paymentsConfirmed: number;
  avgRating: number | null;
}) {
  const hasHistory =
    jobsPosted > 0 ||
    jobsCancelled > 0 ||
    paymentsTracked > 0 ||
    (avgRating != null && avgRating > 0);

  if (!hasHistory) {
    return 80; // new-business baseline
  }

  const paymentRate =
    paymentsTracked > 0 ? paymentsConfirmed / paymentsTracked : 0.8;
  const completionRate =
    jobsPosted > 0 ? jobsCompleted / jobsPosted : 0.8;
  const cancelPenalty =
    jobsPosted > 0 ? Math.min(1, jobsCancelled / jobsPosted) : 0;
  const ratingFactor = avgRating != null ? avgRating / 5 : 0.8;

  const raw =
    paymentRate * 40 +
    completionRate * 25 +
    ratingFactor * 25 +
    (1 - cancelPenalty) * 10;

  return Math.round(Math.max(0, Math.min(100, raw)));
}
