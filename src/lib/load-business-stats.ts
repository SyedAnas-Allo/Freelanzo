import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeBusinessStats,
  type BusinessProfileStats,
} from "@/lib/profile-stats";
import type { JobCategory, JobStatus } from "@/types/database";

const ACTIVE_STATUSES: JobStatus[] = [
  "live",
  "fully_staffed",
  "confirmed",
  "in_progress",
];

export async function loadBusinessStats(
  supabase: SupabaseClient,
  businessId: string,
  ownerId: string,
): Promise<BusinessProfileStats> {
  const [{ data: jobs }, { data: ratings }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, category")
      .eq("business_id", businessId)
      .neq("status", "draft"),
    supabase.from("ratings").select("overall").eq("to_user_id", ownerId),
  ]);

  const jobRows = jobs ?? [];
  const jobIds = jobRows.map((j) => j.id);
  const jobsPosted = jobRows.length;
  const jobsCompleted = jobRows.filter((j) => j.status === "completed").length;
  const jobsCancelled = jobRows.filter((j) => j.status === "cancelled").length;
  const activeGigs = jobRows.filter((j) =>
    ACTIVE_STATUSES.includes(j.status as JobStatus),
  ).length;

  const categoryCounts = new Map<JobCategory, number>();
  for (const job of jobRows) {
    const cat = job.category as JobCategory;
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  let freelancersHired = 0;
  let paymentsTracked = 0;
  let paymentsConfirmed = 0;

  if (jobIds.length) {
    const { data: apps } = await supabase
      .from("applications")
      .select("id, status")
      .in("job_id", jobIds)
      .eq("status", "accepted");

    const accepted = apps ?? [];
    freelancersHired = accepted.length;
    const appIds = accepted.map((a) => a.id);

    if (appIds.length) {
      const { data: payments } = await supabase
        .from("payments")
        .select("status")
        .in("application_id", appIds);
      paymentsTracked = payments?.length ?? 0;
      paymentsConfirmed = (payments ?? []).filter(
        (p) => p.status === "confirmed",
      ).length;
    }
  }

  const reviewCount = ratings?.length ?? 0;
  const avgRating =
    reviewCount > 0
      ? ratings!.reduce((s, r) => s + Number(r.overall), 0) / reviewCount
      : null;

  return computeBusinessStats({
    jobsPosted,
    jobsCompleted,
    jobsCancelled,
    freelancersHired,
    paymentsTracked,
    paymentsConfirmed,
    avgRating,
    reviewCount,
    activeGigs,
    categories,
  });
}
