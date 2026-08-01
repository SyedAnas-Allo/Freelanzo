import { notFound, redirect } from "next/navigation";
import { RateClient } from "@/components/rate-client";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/types/database";

export default async function BusinessRatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, business } = await getSessionProfile();
  if (!business) redirect("/business/setup");

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!job) notFound();

  const { data: apps } = await supabase
    .from("applications")
    .select("id, freelancer_id, profiles(full_name)")
    .eq("job_id", id)
    .eq("status", "accepted");

  const appList = apps ?? [];
  if (!appList.length) redirect(`/business/jobs/${id}/applicants`);

  const appIds = appList.map((application) => application.id);
  const [{ data: confirmedPayments }, { data: ratings }] = await Promise.all([
    supabase
      .from("payments")
      .select("application_id")
      .in("application_id", appIds)
      .eq("status", "confirmed"),
    supabase
      .from("ratings")
      .select("application_id")
      .in("application_id", appIds)
      .eq("from_user_id", user!.id),
  ]);

  const eligibleIds = new Set(
    (confirmedPayments ?? []).map((payment) => payment.application_id),
  );
  const eligible = appList.filter((application) =>
    eligibleIds.has(application.id),
  );
  if (!eligible.length) redirect(`/business/jobs/${id}/payment`);

  const ratedIds = new Set(
    (ratings ?? []).map((rating) => rating.application_id),
  );
  const target =
    eligible.find((application) => !ratedIds.has(application.id)) ?? eligible[0]!;
  const { data: existing } = await supabase
    .from("ratings")
    .select("id")
    .eq("application_id", target.id)
    .eq("from_user_id", user!.id)
    .maybeSingle();

  const name =
    (target.profiles as unknown as { full_name: string | null } | null)?.full_name ||
    "Freelancer";

  return (
    <RateClient
      job={job as Job}
      applicationId={target.id}
      mode="business"
      alreadyRated={!!existing}
      counterpartName={name}
      reportedUserId={target.freelancer_id}
    />
  );
}
