import type { AttendanceRecordView } from "@/components/attendance-record-card";
import { attendanceKindLabel } from "@/lib/attendance";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceKind } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type AttendanceEventRow = {
  id: string;
  application_id?: string;
  kind: string;
  work_date: string;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  verified_at: string;
  created_at: string;
  source: string | null;
};

async function toRecordView(
  supabase: ServerClient,
  event: AttendanceEventRow,
  title: string,
): Promise<AttendanceRecordView> {
  let photoUrl: string | null = null;
  if (event.photo_path) {
    const { data } = await supabase.storage
      .from("attendance-photos")
      .createSignedUrl(event.photo_path, 60 * 60);
    photoUrl = data?.signedUrl ?? null;
  }

  return {
    id: event.id,
    title,
    verifiedAt: event.verified_at ?? event.created_at,
    lat: event.lat,
    lng: event.lng,
    photoUrl,
    source: event.source as "otp" | "manual_correction" | null,
  };
}

export async function loadAttendanceRecordView(
  supabase: ServerClient,
  applicationId: string,
  kind: AttendanceKind,
  workDate: string,
): Promise<AttendanceRecordView | null> {
  const { data: event } = await supabase
    .from("attendance_events")
    .select(
      "id, kind, work_date, photo_path, lat, lng, verified_at, created_at, source",
    )
    .eq("application_id", applicationId)
    .eq("kind", kind)
    .eq("work_date", workDate)
    .maybeSingle();

  if (!event) return null;

  return toRecordView(supabase, event, attendanceKindLabel(kind));
}

export async function loadAttendanceRecordsForApplication(
  supabase: ServerClient,
  applicationId: string,
): Promise<AttendanceRecordView[]> {
  const { data: events } = await supabase
    .from("attendance_events")
    .select(
      "id, kind, work_date, photo_path, lat, lng, verified_at, created_at, source",
    )
    .eq("application_id", applicationId)
    .order("verified_at", { ascending: true });

  if (!events?.length) return [];

  return Promise.all(
    events.map((event) => {
      const kind = event.kind as AttendanceKind;
      const daySuffix = event.work_date ? ` · ${event.work_date}` : "";
      return toRecordView(
        supabase,
        event,
        `${attendanceKindLabel(kind)}${daySuffix}`,
      );
    }),
  );
}

/** Records keyed by application_id for business applicant cards. */
export async function loadAttendanceRecordsByApplication(
  supabase: ServerClient,
  applicationIds: string[],
): Promise<Map<string, AttendanceRecordView[]>> {
  const map = new Map<string, AttendanceRecordView[]>();
  if (!applicationIds.length) return map;

  const { data: events } = await supabase
    .from("attendance_events")
    .select(
      "id, application_id, kind, work_date, photo_path, lat, lng, verified_at, created_at, source",
    )
    .in("application_id", applicationIds)
    .order("verified_at", { ascending: true });

  if (!events?.length) return map;

  const views = await Promise.all(
    events.map(async (event) => {
      const kind = event.kind as AttendanceKind;
      const daySuffix = event.work_date ? ` · ${event.work_date}` : "";
      const record = await toRecordView(
        supabase,
        event,
        `${attendanceKindLabel(kind)}${daySuffix}`,
      );
      return { applicationId: event.application_id as string, record };
    }),
  );

  for (const { applicationId, record } of views) {
    const list = map.get(applicationId) ?? [];
    list.push(record);
    map.set(applicationId, list);
  }

  return map;
}
