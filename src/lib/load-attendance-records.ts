import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRecordView } from "@/components/attendance-record-card";
import { attendanceKindLabel } from "@/lib/attendance";
import type { AttendanceKind } from "@/types/database";

export type AttendanceEventRow = {
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

const ATTENDANCE_EVENT_SELECT =
  "id, application_id, kind, work_date, photo_path, lat, lng, verified_at, created_at, source";

function recordTitle(event: Pick<AttendanceEventRow, "kind" | "work_date">) {
  const kind = event.kind as AttendanceKind;
  const daySuffix = event.work_date ? ` · ${event.work_date}` : "";
  return `${attendanceKindLabel(kind)}${daySuffix}`;
}

function toRecordViewWithoutPhoto(
  event: AttendanceEventRow,
  title: string,
  photoUrl: string | null,
): AttendanceRecordView {
  return {
    id: event.id,
    title,
    verifiedAt: event.verified_at ?? event.created_at,
    lat: event.lat,
    lng: event.lng,
    photoUrl,
    source: event.source as
      | "otp"
      | "manual_correction"
      | "business_confirmation"
      | null,
  };
}

async function signAttendancePhotos(
  supabase: SupabaseClient,
  events: AttendanceEventRow[],
): Promise<Map<string, string>> {
  const paths = [
    ...new Set(
      events
        .map((event) => event.photo_path)
        .filter((path): path is string => !!path),
    ),
  ];
  if (!paths.length) return new Map();

  const { data } = await supabase.storage
    .from("attendance-photos")
    .createSignedUrls(paths, 60 * 60);

  const signedByPath = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) {
      signedByPath.set(row.path, row.signedUrl);
    }
  }
  return signedByPath;
}

async function toRecordViews(
  supabase: SupabaseClient,
  events: AttendanceEventRow[],
): Promise<AttendanceRecordView[]> {
  if (!events.length) return [];
  const signedByPath = await signAttendancePhotos(supabase, events);
  return events.map((event) =>
    toRecordViewWithoutPhoto(
      event,
      recordTitle(event),
      event.photo_path ? (signedByPath.get(event.photo_path) ?? null) : null,
    ),
  );
}

async function toRecordView(
  supabase: SupabaseClient,
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
  return toRecordViewWithoutPhoto(event, title, photoUrl);
}

export async function loadAttendanceRecordView(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  applicationId: string,
): Promise<AttendanceRecordView[]> {
  const { records } = await loadAttendanceBundleForApplication(
    supabase,
    applicationId,
  );
  return records;
}

/** One attendance query for both lifecycle projection and record cards. */
export async function loadAttendanceBundleForApplication(
  supabase: SupabaseClient,
  applicationId: string,
  options?: { includeRecords?: boolean },
): Promise<{
  events: AttendanceEventRow[];
  records: AttendanceRecordView[];
}> {
  const includeRecords = options?.includeRecords !== false;
  const { data: events } = await supabase
    .from("attendance_events")
    .select(ATTENDANCE_EVENT_SELECT)
    .eq("application_id", applicationId)
    .order("verified_at", { ascending: true });

  const rows = (events ?? []) as AttendanceEventRow[];
  if (!rows.length) return { events: [], records: [] };

  return {
    events: rows,
    records: includeRecords ? await toRecordViews(supabase, rows) : [],
  };
}

/** Records keyed by application_id for business applicant cards. */
export async function loadAttendanceRecordsByApplication(
  supabase: SupabaseClient,
  applicationIds: string[],
): Promise<Map<string, AttendanceRecordView[]>> {
  const { recordsByApplication } = await loadAttendanceBundleByApplication(
    supabase,
    applicationIds,
  );
  return recordsByApplication;
}

export async function loadAttendanceBundleByApplication(
  supabase: SupabaseClient,
  applicationIds: string[],
): Promise<{
  events: AttendanceEventRow[];
  recordsByApplication: Map<string, AttendanceRecordView[]>;
}> {
  const recordsByApplication = new Map<string, AttendanceRecordView[]>();
  if (!applicationIds.length) {
    return { events: [], recordsByApplication };
  }

  const { data: events } = await supabase
    .from("attendance_events")
    .select(ATTENDANCE_EVENT_SELECT)
    .in("application_id", applicationIds)
    .order("verified_at", { ascending: true });

  const rows = (events ?? []) as AttendanceEventRow[];
  if (!rows.length) return { events: [], recordsByApplication };

  const views = await toRecordViews(supabase, rows);
  for (let i = 0; i < rows.length; i += 1) {
    const applicationId = rows[i].application_id as string;
    const list = recordsByApplication.get(applicationId) ?? [];
    list.push(views[i]);
    recordsByApplication.set(applicationId, list);
  }

  return { events: rows, recordsByApplication };
}
