"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { AttendanceRecordView } from "@/components/attendance-record-card";
import { BusinessAttendanceClient } from "@/components/business-attendance-client";
import { PageLoading } from "@/components/page-loading";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import { localDateISO, jobWorkDates, pickAttendanceDay } from "@/lib/work-dates";
import type { AttendanceKind, AttendanceOtp, Job } from "@/types/database";

type MissedWorker = {
  applicationId: string;
  name: string;
  needs: AttendanceKind;
};

type AttendancePageData = {
  job: Job;
  kind: AttendanceKind;
  workDate: string;
  otp: AttendanceOtp | null;
  applicationIds: string[];
  checkedInCount: number;
  checkedOutCount: number;
  dayDoneCount: Record<string, number>;
  attendanceRecords: AttendanceRecordView[];
  missedWorkers: MissedWorker[];
};

async function loadAttendanceData(
  id: string,
  kindParam: string | null,
  dateParam: string | null,
): Promise<
  | { ok: true; data: AttendancePageData }
  | { ok: false; reason: "setup" | "not_found" }
> {
  const { business } = await fetchSessionProfile();
  if (!business) return { ok: false, reason: "setup" };

  const kind: AttendanceKind =
    kindParam === "check_out" ? "check_out" : "check_in";

  const supabase = createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!job) return { ok: false, reason: "not_found" };

  const typedJob = job as Job;
  const dates = jobWorkDates(typedJob);
  const today = localDateISO();
  const workDate =
    dateParam && dates.includes(dateParam)
      ? dateParam
      : pickAttendanceDay(dates);

  const { data: otp } = await supabase
    .from("attendance_otps")
    .select("*")
    .eq("job_id", id)
    .eq("kind", kind)
    .eq("work_date", workDate)
    .maybeSingle();

  const { data: apps } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", id)
    .eq("status", "accepted");

  const appIds = (apps ?? []).map((a) => a.id);
  let checkedInCount = 0;
  let checkedOutCount = 0;
  const dayDoneCount: Record<string, number> = {};
  let attendanceRecords: AttendanceRecordView[] = [];
  const missedWorkers: MissedWorker[] = [];

  if (appIds.length) {
    const [{ data: events }, { data: contacts }] = await Promise.all([
      supabase
        .from("attendance_events")
        .select(
          "id, application_id, kind, work_date, photo_path, lat, lng, verified_at, created_at, source",
        )
        .in("application_id", appIds),
      supabase
        .from("freelancer_contacts")
        .select("application_id, full_name")
        .eq("job_id", id)
        .eq("status", "accepted"),
    ]);

    checkedInCount = new Set(
      (events ?? [])
        .filter((e) => e.kind === "check_in" && e.work_date === workDate)
        .map((e) => e.application_id),
    ).size;
    checkedOutCount = new Set(
      (events ?? [])
        .filter((e) => e.kind === "check_out" && e.work_date === workDate)
        .map((e) => e.application_id),
    ).size;

    for (const d of dates) {
      const outs = new Set(
        (events ?? [])
          .filter((e) => e.kind === "check_out" && e.work_date === d)
          .map((e) => e.application_id),
      );
      dayDoneCount[d] = outs.size;
    }

    const namesByApplication = new Map(
      (contacts ?? []).map((contact) => [
        contact.application_id,
        contact.full_name ?? "Freelancer",
      ]),
    );

    if (workDate < today) {
      for (const appId of appIds) {
        const hasIn = (events ?? []).some(
          (e) =>
            e.application_id === appId &&
            e.kind === "check_in" &&
            e.work_date === workDate,
        );
        const hasOut = (events ?? []).some(
          (e) =>
            e.application_id === appId &&
            e.kind === "check_out" &&
            e.work_date === workDate,
        );
        if (!hasIn) {
          missedWorkers.push({
            applicationId: appId,
            name: namesByApplication.get(appId) ?? "Freelancer",
            needs: "check_in",
          });
        } else if (!hasOut) {
          missedWorkers.push({
            applicationId: appId,
            name: namesByApplication.get(appId) ?? "Freelancer",
            needs: "check_out",
          });
        }
      }
    }

    const dayEvents = (events ?? []).filter(
      (event) => event.work_date === workDate,
    );

    attendanceRecords = (
      await Promise.all(
        dayEvents.map(async (event) => {
          let photoUrl: string | null = null;
          if (event.photo_path) {
            const { data } = await supabase.storage
              .from("attendance-photos")
              .createSignedUrl(event.photo_path, 60 * 60);
            photoUrl = data?.signedUrl ?? null;
          }

          const name =
            namesByApplication.get(event.application_id) ?? "Freelancer";
          const kindLabel =
            event.kind === "check_out" ? "Check-Out" : "Check-In";

          return {
            id: event.id,
            title: `${name} · ${kindLabel}`,
            verifiedAt: event.verified_at ?? event.created_at,
            lat: event.lat,
            lng: event.lng,
            photoUrl,
            source: event.source as "otp" | "manual_correction" | null,
          };
        }),
      )
    ).sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt));
  }

  return {
    ok: true,
    data: {
      job: typedJob,
      kind,
      workDate,
      otp: (otp as AttendanceOtp | null) ?? null,
      applicationIds: appIds,
      checkedInCount,
      checkedOutCount,
      dayDoneCount,
      attendanceRecords,
      missedWorkers,
    },
  };
}

function BusinessAttendancePageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const kindParam = searchParams.get("kind");
  const dateParam = searchParams.get("date");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [data, setData] = useState<AttendancePageData | null>(null);

  const reload = useCallback(async () => {
    const result = await loadAttendanceData(id, kindParam, dateParam);
    if (!result.ok) {
      if (result.reason === "setup") {
        router.replace("/business/setup");
        return;
      }
      setNotFoundState(true);
      setData(null);
      setLoading(false);
      return;
    }
    setData(result.data);
    setNotFoundState(false);
    setLoading(false);
  }, [id, kindParam, dateParam, router]);

  useEffect(() => {
    // Client data load — setState runs after awaited Supabase calls.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/params
    void reload();
  }, [reload]);

  if (loading) return <PageLoading />;
  if (notFoundState || !data) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  return (
    <BusinessAttendanceClient
      key={`${data.kind}-${data.workDate}`}
      job={data.job}
      kind={data.kind}
      workDate={data.workDate}
      initialOtp={data.otp}
      applicationIds={data.applicationIds}
      checkedInCount={data.checkedInCount}
      checkedOutCount={data.checkedOutCount}
      acceptedCount={data.applicationIds.length}
      dayDoneCount={data.dayDoneCount}
      attendanceRecords={data.attendanceRecords}
      missedWorkers={data.missedWorkers}
      onReload={() => {
        void reload();
      }}
    />
  );
}

export default function BusinessAttendancePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BusinessAttendancePageInner />
    </Suspense>
  );
}
