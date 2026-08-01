import { notFound, redirect } from "next/navigation";
import { FreelancerAttendanceClient } from "@/components/freelancer-attendance-client";
import { getSessionProfile } from "@/lib/auth";
import { loadAttendanceRecordView } from "@/lib/load-attendance-records";
import { createClient } from "@/lib/supabase/server";
import { jobWorkDates, pickAttendanceDay } from "@/lib/work-dates";
import type { Job } from "@/types/database";

export default async function FreelancerCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const { user } = await getSessionProfile();
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const typedJob = job as Job;
  const dates = jobWorkDates(typedJob);
  const workDate =
    dateParam && dates.includes(dateParam)
      ? dateParam
      : pickAttendanceDay(dates);

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

  const alreadyDone = (events ?? []).some(
    (e) => e.kind === "check_in" && e.work_date === workDate,
  );

  const recordedEvent = alreadyDone
    ? await loadAttendanceRecordView(supabase, app.id, "check_in", workDate)
    : null;

  return (
    <FreelancerAttendanceClient
      job={typedJob}
      applicationId={app.id}
      kind="check_in"
      workDate={workDate}
      alreadyDone={alreadyDone}
      dayEvents={events ?? []}
      recordedEvent={recordedEvent}
    />
  );
}
