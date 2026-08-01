import { notFound, redirect } from "next/navigation";
import { FreelancerPaymentClient } from "@/components/freelancer-payment-client";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAttendanceComplete, jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment } from "@/types/database";

export default async function FreelancerPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getSessionProfile();
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const typedJob = job as Job;

  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", id)
    .eq("freelancer_id", user!.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!app) redirect(`/freelancer/jobs/${id}`);

  const { data: events } = await supabase
    .from("attendance_events")
    .select("kind, work_date")
    .eq("application_id", app.id);

  if (!isAttendanceComplete(jobWorkDates(typedJob), events ?? [])) {
    redirect(`/freelancer/jobs/${id}`);
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("application_id", app.id)
    .maybeSingle();

  return (
    <FreelancerPaymentClient
      job={typedJob}
      applicationId={app.id}
      payment={(payment as Payment | null) ?? null}
    />
  );
}
