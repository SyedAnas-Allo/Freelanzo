import {
  computeBusinessTrustScore,
  computeReliabilityScore,
} from "@/lib/reliability";
import type { JobCategory } from "@/types/database";

export type FreelancerProfileStats = {
  jobsCompleted: number;
  acceptedJobs: number;
  attendanceRate: number;
  cancellationRate: number;
  noShowRate: number;
  reliability: number;
  avgRating: number | null;
  reviewCount: number;
  totalEarnings: number;
  jobsInProgress: number;
};

export type BusinessProfileStats = {
  jobsPosted: number;
  jobsCompleted: number;
  jobsCancelled: number;
  freelancersHired: number;
  paymentRate: number;
  cancelRate: number;
  reliability: number;
  avgRating: number | null;
  reviewCount: number;
  activeGigs: number;
  categories: JobCategory[];
};

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

export function yearsActiveSince(createdAt: string | null | undefined): string {
  if (!createdAt) return "—";
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return "—";
  const years =
    (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return "<1 Year";
  return `${Math.floor(years)}+ Years`;
}

export function reliabilityLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Needs work";
}

/** Convert 0–100 reliability to a 0–5 display value. */
export function reliabilityOutOfFive(score: number): number {
  return Math.round((score / 20) * 10) / 10;
}

export function computeFreelancerStats(input: {
  acceptedJobs: number;
  checkedIn: number;
  completedCheckouts: number;
  cancelled: number;
  avgRating: number | null;
  reviewCount: number;
  totalEarnings?: number;
  jobsInProgress?: number;
}): FreelancerProfileStats {
  const {
    acceptedJobs,
    checkedIn,
    completedCheckouts,
    cancelled,
    avgRating,
    reviewCount,
  } = input;

  const attendanceRate =
    acceptedJobs > 0 ? Math.round((checkedIn / acceptedJobs) * 100) : 100;
  const cancelDenom = acceptedJobs + cancelled;
  const cancellationRate =
    cancelDenom > 0 ? Math.round((cancelled / cancelDenom) * 100) : 0;
  const noShows = Math.max(0, acceptedJobs - checkedIn);
  const noShowRate =
    acceptedJobs > 0 ? Math.round((noShows / acceptedJobs) * 100) : 0;

  return {
    jobsCompleted: completedCheckouts,
    acceptedJobs,
    attendanceRate,
    cancellationRate,
    noShowRate,
    reliability: computeReliabilityScore({
      acceptedJobs,
      checkedIn,
      completedCheckouts,
      cancelled,
      avgRating,
    }),
    avgRating,
    reviewCount,
    totalEarnings: input.totalEarnings ?? 0,
    jobsInProgress: input.jobsInProgress ?? Math.max(0, checkedIn - completedCheckouts),
  };
}

export function computeBusinessStats(input: {
  jobsPosted: number;
  jobsCompleted: number;
  jobsCancelled: number;
  freelancersHired: number;
  paymentsTracked: number;
  paymentsConfirmed: number;
  avgRating: number | null;
  reviewCount: number;
  activeGigs?: number;
  categories?: JobCategory[];
}): BusinessProfileStats {
  const {
    jobsPosted,
    jobsCompleted,
    jobsCancelled,
    freelancersHired,
    paymentsTracked,
    paymentsConfirmed,
    avgRating,
    reviewCount,
  } = input;

  const paymentRate =
    paymentsTracked > 0
      ? Math.round((paymentsConfirmed / paymentsTracked) * 100)
      : 100;
  const cancelRate =
    jobsPosted > 0 ? Math.round((jobsCancelled / jobsPosted) * 100) : 0;

  return {
    jobsPosted,
    jobsCompleted,
    jobsCancelled,
    freelancersHired,
    paymentRate,
    cancelRate,
    reliability: computeBusinessTrustScore({
      jobsPosted,
      jobsCompleted,
      jobsCancelled,
      paymentsTracked,
      paymentsConfirmed,
      avgRating,
    }),
    avgRating,
    reviewCount,
    activeGigs: input.activeGigs ?? 0,
    categories: input.categories ?? [],
  };
}
