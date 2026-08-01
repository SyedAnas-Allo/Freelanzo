import { notFound, redirect } from "next/navigation";
import { BusinessPaymentClient } from "@/components/business-payment-client";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAttendanceComplete, jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment, Profile } from "@/types/database";

export default async function BusinessPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await getSessionProfile();
  if (!business) redirect("/business/setup");

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!job) notFound();
  const typedJob = job as Job;
  const dates = jobWorkDates(typedJob);

  const { data: apps } = await supabase
    .from("applications")
    .select("id, profiles(*)")
    .eq("job_id", id)
    .eq("status", "accepted");

  const appIds = (apps ?? []).map((a) => a.id);
  const [{ data: payments }, { data: events }] = await Promise.all([
    appIds.length
      ? supabase.from("payments").select("*").in("application_id", appIds)
      : Promise.resolve({ data: [] as Payment[] }),
    appIds.length
      ? supabase
          .from("attendance_events")
          .select("application_id, kind, work_date")
          .in("application_id", appIds)
      : Promise.resolve({ data: [] as { application_id: string; kind: string; work_date: string }[] }),
  ]);

  const eventsByApp = new Map<string, { kind: string; work_date: string }[]>();
  for (const e of events ?? []) {
    const list = eventsByApp.get(e.application_id) ?? [];
    list.push({ kind: e.kind, work_date: e.work_date });
    eventsByApp.set(e.application_id, list);
  }

  const eligibleApps = (apps ?? []).filter((a) =>
    isAttendanceComplete(dates, eventsByApp.get(a.id) ?? []),
  );

  if (eligibleApps.length === 0) {
    redirect(`/business/jobs/${id}/attendance`);
  }

  const payMap = new Map((payments ?? []).map((p) => [p.application_id, p as Payment]));

  const workers = eligibleApps.map((a) => ({
    applicationId: a.id,
    profile: a.profiles as unknown as Profile,
    payment: payMap.get(a.id) ?? null,
  }));

  return <BusinessPaymentClient job={typedJob} workers={workers} />;
}
