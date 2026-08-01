import { notFound, redirect } from "next/navigation";
import { RateClient } from "@/components/rate-client";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/types/database";

export default async function FreelancerRatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getSessionProfile();
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, business_profiles(business_name, owner_id)")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", id)
    .eq("freelancer_id", user!.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!app) redirect(`/freelancer/jobs/${id}`);

  const { data: payment } = await supabase
    .from("payments")
    .select("status")
    .eq("application_id", app.id)
    .maybeSingle();

  if (!payment || payment.status !== "confirmed") {
    redirect(`/freelancer/jobs/${id}/payment`);
  }

  const { data: existing } = await supabase
    .from("ratings")
    .select("id")
    .eq("application_id", app.id)
    .eq("from_user_id", user!.id)
    .maybeSingle();

  const biz = job.business_profiles as unknown as {
    business_name: string;
    owner_id: string;
  } | null;

  if (!biz?.owner_id) notFound();

  return (
    <RateClient
      job={job as Job}
      applicationId={app.id}
      mode="freelancer"
      alreadyRated={!!existing}
      counterpartName={biz.business_name || "Business"}
      reportedUserId={biz.owner_id}
    />
  );
}
