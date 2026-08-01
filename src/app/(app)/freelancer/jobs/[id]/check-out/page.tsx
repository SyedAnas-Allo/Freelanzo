"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FreelancerAttendanceClient } from "@/components/freelancer-attendance-client";
import { PageLoading } from "@/components/page-loading";
import type { AttendanceRecordView } from "@/components/attendance-record-card";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { loadAttendanceRecordView } from "@/lib/load-attendance-records";
import { createClient } from "@/lib/supabase/client";
import { jobWorkDates, pickAttendanceDay } from "@/lib/work-dates";
import type { Job } from "@/types/database";

function FreelancerCheckOutPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") ?? undefined;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [workDate, setWorkDate] = useState("");
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [dayEvents, setDayEvents] = useState<{ kind: string; work_date: string }[]>(
    [],
  );
  const [recordedEvent, setRecordedEvent] =
    useState<AttendanceRecordView | null>(null);

  useEffect(() => {
    async function load() {
      const { user } = await fetchSessionProfile();
      if (!user) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!jobRow) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      const typedJob = jobRow as Job;
      const dates = jobWorkDates(typedJob);
      const resolvedDate =
        dateParam && dates.includes(dateParam)
          ? dateParam
          : pickAttendanceDay(dates);

      const { data: app } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", id)
        .eq("freelancer_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();
      if (!app) {
        router.replace(`/freelancer/jobs/${id}`);
        return;
      }

      const { data: events } = await supabase
        .from("attendance_events")
        .select("kind, work_date")
        .eq("application_id", app.id);

      const hasCheckIn = (events ?? []).some(
        (e) => e.kind === "check_in" && e.work_date === resolvedDate,
      );
      if (!hasCheckIn) {
        router.replace(
          `/freelancer/jobs/${id}/check-in?date=${resolvedDate}`,
        );
        return;
      }

      const done = (events ?? []).some(
        (e) => e.kind === "check_out" && e.work_date === resolvedDate,
      );

      const recorded = done
        ? await loadAttendanceRecordView(
            supabase,
            app.id,
            "check_out",
            resolvedDate,
          )
        : null;

      setJob(typedJob);
      setApplicationId(app.id);
      setWorkDate(resolvedDate);
      setAlreadyDone(done);
      setDayEvents(events ?? []);
      setRecordedEvent(recorded);
      setLoading(false);
    }
    void load();
  }, [id, dateParam, router]);

  if (loading) return <PageLoading />;
  if (notFoundState || !job || !applicationId) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  return (
    <FreelancerAttendanceClient
      job={job}
      applicationId={applicationId}
      kind="check_out"
      workDate={workDate}
      alreadyDone={alreadyDone}
      dayEvents={dayEvents}
      recordedEvent={recordedEvent}
    />
  );
}

export default function FreelancerCheckOutPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FreelancerCheckOutPageInner />
    </Suspense>
  );
}
