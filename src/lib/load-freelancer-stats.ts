import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeFreelancerStats,
  type FreelancerProfileStats,
} from "@/lib/profile-stats";

export async function loadFreelancerStats(
  supabase: SupabaseClient,
  freelancerId: string,
): Promise<FreelancerProfileStats> {
  const [{ data: apps }, { data: ratings }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status")
      .eq("freelancer_id", freelancerId),
    supabase.from("ratings").select("overall").eq("to_user_id", freelancerId),
  ]);

  const accepted = (apps ?? []).filter((a) => a.status === "accepted");
  const cancelled = (apps ?? []).filter((a) => a.status === "cancelled");
  const appIds = accepted.map((a) => a.id);

  let checkedIn = 0;
  let checkedOut = 0;
  let totalEarnings = 0;
  if (appIds.length) {
    const [{ data: events }, { data: payments }] = await Promise.all([
      supabase
        .from("attendance_events")
        .select("application_id, kind")
        .in("application_id", appIds),
      supabase
        .from("payments")
        .select("amount")
        .in("application_id", appIds)
        .eq("status", "confirmed"),
    ]);
    checkedIn = new Set(
      (events ?? [])
        .filter((e) => e.kind === "check_in")
        .map((e) => e.application_id),
    ).size;
    checkedOut = new Set(
      (events ?? [])
        .filter((e) => e.kind === "check_out")
        .map((e) => e.application_id),
    ).size;
    totalEarnings = (payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
  }

  const reviewCount = ratings?.length ?? 0;
  const avgRating =
    reviewCount > 0
      ? ratings!.reduce((s, r) => s + Number(r.overall), 0) / reviewCount
      : null;

  return computeFreelancerStats({
    acceptedJobs: accepted.length,
    checkedIn,
    completedCheckouts: checkedOut,
    cancelled: cancelled.length,
    avgRating,
    reviewCount,
    totalEarnings,
    jobsInProgress: Math.max(0, checkedIn - checkedOut),
  });
}
