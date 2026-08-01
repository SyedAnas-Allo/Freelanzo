import type { AttendanceEvent, AttendanceKind, AttendanceOtp } from "@/types/database";

export function attendanceKindLabel(kind: AttendanceKind) {
  return kind === "check_in" ? "Check-In" : "Check-Out";
}

/** When the event was verified (falls back to created_at). */
export function formatAttendanceDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function attendanceMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function formatAttendanceCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function hasEvent(
  events: AttendanceEvent[] | null | undefined,
  kind: AttendanceKind,
) {
  return (events ?? []).some((e) => e.kind === kind);
}

export function isOtpValid(otp: AttendanceOtp | null | undefined) {
  if (!otp) return false;
  return new Date(otp.expires_at).getTime() > Date.now();
}
