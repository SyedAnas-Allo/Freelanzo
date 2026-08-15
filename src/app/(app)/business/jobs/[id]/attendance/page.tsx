"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { AttendanceRecordView } from "@/components/attendance-record-card";
import {
  BusinessAttendanceClient,
  type AttendanceRequestView,
} from "@/components/business-attendance-client";
import { PageLoading } from "@/components/page-loading";
import { useRouter } from "@/hooks/use-app-router";
import { fetchBusinessSession } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import { localDateISO, jobWorkDates, pickAttendanceDay } from "@/lib/work-dates";
import type { AttendanceKind, Job } from "@/types/database";

type MissedWorker = {
  applicationId: string;
  name: string;
  needs: AttendanceKind;
};

type AttendancePageData = {
  job: Job;
  kind: AttendanceKind;
  workDate: string;
  applicationIds: string[];
  checkedInCount: number;
  checkedOutCount: number;
  dayDoneCount: Record<string, number>;
  attendanceRecords: AttendanceRecordView[];
  attendanceRequests: AttendanceRequestView[];
  missedWorkers: MissedWorker[];
};

async function loadAttendanceData(
  id: string,
  kindParam: string | null,
  dateParam: string | null,
  onCoreLoaded?: (data: AttendancePageData) => void,
): Promise<
  | { ok: true; data: AttendancePageData }
  | { ok: false; reason: "setup" | "not_found" }
> {
  const { business } = await fetchBusinessSession();
  if (!business) return { ok: false, reason: "setup" };

  const kind: AttendanceKind =
    kindParam === "check_out" ? "check_out" : "check_in";

  const supabase = createClient();
  const [{ data: job }, { data: apps }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("business_id", business.id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id")
      .eq("job_id", id)
      .eq("status", "accepted"),
  ]);
  if (!job) return { ok: false, reason: "not_found" };

  const typedJob = job as Job;
  const dates = jobWorkDates(typedJob);
  const today = localDateISO();
  const workDate =
    dateParam && dates.includes(dateParam)
      ? dateParam
      : pickAttendanceDay(dates);

  const appIds = (apps ?? []).map((a) => a.id);
  let checkedInCount = 0;
  let checkedOutCount = 0;
  const dayDoneCount: Record<string, number> = {};
  let attendanceRecords: AttendanceRecordView[] = [];
  let attendanceRequests: AttendanceRequestView[] = [];
  const missedWorkers: MissedWorker[] = [];

  onCoreLoaded?.({
    job: typedJob,
    kind,
    workDate,
    applicationIds: appIds,
    checkedInCount,
    checkedOutCount,
    dayDoneCount,
    attendanceRecords,
    attendanceRequests,
    missedWorkers,
  });

  if (appIds.length) {
    const [
      { data: events },
      { data: contacts },
      { data: requests },
    ] = await Promise.all([
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
      supabase
        .from("attendance_requests")
        .select(
          "id, application_id, kind, work_date, photo_path, lat, lng, status, rejection_reason, requested_at, expires_at",
        )
        .in("application_id", appIds)
        .eq("kind", kind)
        .eq("work_date", workDate)
        .order("requested_at", { ascending: true }),
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

    const dayEvents = (events ?? []).filter(
      (event) => event.work_date === workDate,
    );
    const photoPaths = [
      ...new Set(
        [...(requests ?? []), ...dayEvents]
          .map((row) => row.photo_path)
          .filter((path): path is string => !!path),
      ),
    ];
    const signedByPath = new Map<string, string>();
    if (photoPaths.length) {
      const { data: signedPhotos } = await supabase.storage
        .from("attendance-photos")
        .createSignedUrls(photoPaths, 60 * 60);
      for (const photo of signedPhotos ?? []) {
        if (photo.path && photo.signedUrl) {
          signedByPath.set(photo.path, photo.signedUrl);
        }
      }
    }

    attendanceRequests = (requests ?? []).map(
      (request) =>
        ({
          id: request.id,
          applicationId: request.application_id,
          name:
            namesByApplication.get(request.application_id) ?? "Freelancer",
          kind: request.kind,
          workDate: request.work_date,
          requestedAt: request.requested_at,
          expiresAt: request.expires_at,
          lat: request.lat,
          lng: request.lng,
          photoUrl: request.photo_path
            ? (signedByPath.get(request.photo_path) ?? null)
            : null,
          status:
            request.status === "pending" &&
            new Date(request.expires_at).getTime() <= Date.now()
              ? "expired"
              : request.status,
          rejectionReason: request.rejection_reason,
        }) as AttendanceRequestView,
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

    attendanceRecords = dayEvents
      .map((event) => {
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
          photoUrl: event.photo_path
            ? (signedByPath.get(event.photo_path) ?? null)
            : null,
          source: event.source as
            | "otp"
            | "manual_correction"
            | "business_confirmation"
            | null,
        };
      })
      .sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt));
  }

  return {
    ok: true,
    data: {
      job: typedJob,
      kind,
      workDate,
      applicationIds: appIds,
      checkedInCount,
      checkedOutCount,
      dayDoneCount,
      attendanceRecords,
      attendanceRequests,
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
  const requestVersionRef = useRef(0);

  const reload = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;
    const result = await loadAttendanceData(
      id,
      kindParam,
      dateParam,
      (coreData) => {
        if (requestVersion !== requestVersionRef.current) return;
        setData((current) =>
          current?.job.id === coreData.job.id &&
          current.kind === coreData.kind &&
          current.workDate === coreData.workDate
            ? current
            : coreData,
        );
        setNotFoundState(false);
        setLoading(false);
      },
    );
    if (requestVersion !== requestVersionRef.current) return;
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
    void reload();
    return () => {
      requestVersionRef.current += 1;
    };
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
      applicationIds={data.applicationIds}
      checkedInCount={data.checkedInCount}
      checkedOutCount={data.checkedOutCount}
      acceptedCount={data.applicationIds.length}
      dayDoneCount={data.dayDoneCount}
      attendanceRecords={data.attendanceRecords}
      attendanceRequests={data.attendanceRequests}
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
