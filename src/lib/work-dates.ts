import {
  attendanceDaysComplete,
  buildAttendanceDayIndex,
} from "@/lib/attendance-days";

/** Local calendar date as YYYY-MM-DD (avoids UTC shift). */
export function localDateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function addDaysISO(iso: string, days: number) {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}

export function daysBetweenISO(a: string, b: string) {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime();
  return Math.round(ms / 86400000);
}

/** Sorted unique work days; falls back to job_date for legacy rows. */
export function jobWorkDates(job: {
  work_dates?: string[] | null;
  job_date: string;
}): string[] {
  const raw = job.work_dates?.filter(Boolean) ?? [];
  if (raw.length === 0) return [job.job_date];
  return [...new Set(raw)].sort();
}

export const MAX_WORK_DAYS = 15;
/** Inclusive window length from first selected day. */
export const WORK_DAY_WINDOW = 15;

/**
 * Toggle a day in the selection.
 * First selected day anchors a 15-day window; days outside it are rejected.
 */
export function toggleWorkDay(
  selected: string[],
  day: string,
): { dates: string[]; error?: string } {
  const set = new Set(selected);
  if (set.has(day)) {
    set.delete(day);
    return { dates: [...set].sort() };
  }

  if (set.size === 0) {
    return { dates: [day] };
  }

  const next = [...set, day].sort();
  const first = next[0]!;
  const last = next[next.length - 1]!;
  if (daysBetweenISO(first, last) > WORK_DAY_WINDOW - 1) {
    return {
      dates: selected,
      error: `Work days must fit in ${WORK_DAY_WINDOW} days from the first day (${first}).`,
    };
  }
  if (next.length > MAX_WORK_DAYS) {
    return {
      dates: selected,
      error: `You can select up to ${MAX_WORK_DAYS} work days.`,
    };
  }
  return { dates: next };
}

function hoursAndMinutes(time: string): [number, number] {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return [hours, minutes];
}

/**
 * When applications close: the end of the shift on the last work day.
 * Mirrors `private.job_application_deadline` — an end time at or before the
 * start time means the shift runs past midnight into the next day.
 */
export function jobApplicationDeadline(
  workDates: string[],
  startTime: string,
  endTime: string,
): Date {
  const sorted = [...workDates].sort();
  const lastDay = sorted[sorted.length - 1] ?? localDateISO();
  const overnight = endTime.slice(0, 5) <= startTime.slice(0, 5);
  const deadline = parseLocalDate(overnight ? addDaysISO(lastDay, 1) : lastDay);
  const [hours, minutes] = hoursAndMinutes(endTime);
  deadline.setHours(hours, minutes, 0, 0);
  return deadline;
}

/**
 * True while a gig can still be listed to freelancers. Once the shift has
 * ended, `available_job_ids` stops returning the gig and it disappears from
 * the freelancer feed, so posting one is pointless.
 */
export function isJobScheduleOpen(
  workDates: string[],
  startTime: string,
  endTime: string,
  now = new Date(),
): boolean {
  if (workDates.length === 0) return false;
  return now < jobApplicationDeadline(workDates, startTime, endTime);
}

/** Prefer today if it's a work day; else next upcoming; else last. */
export function pickAttendanceDay(
  workDates: string[],
  today = localDateISO(),
): string {
  if (workDates.includes(today)) return today;
  const upcoming = workDates.find((d) => d >= today);
  return upcoming ?? workDates[workDates.length - 1]!;
}

/**
 * First work day that still needs check-in or check-out.
 * Prefers missed past days, then today. Future incomplete days are not
 * returned as actionable — callers should treat those as scheduled.
 */
export function nextIncompleteWorkDay(
  workDates: string[],
  events: { kind: string; work_date: string }[],
  today = localDateISO(),
): { date: string; needs: "check_in" | "check_out" } | null {
  const index = buildAttendanceDayIndex(workDates, events);

  for (const date of workDates) {
    if (date >= today) continue;
    const row = index.get(date)!;
    if (!row.checkedIn) return { date, needs: "check_in" };
    if (!row.checkedOut) return { date, needs: "check_out" };
  }

  if (index.has(today)) {
    const todayRow = index.get(today)!;
    if (!todayRow.checkedIn) return { date: today, needs: "check_in" };
    if (!todayRow.checkedOut) return { date: today, needs: "check_out" };
  }

  return null;
}

/** True when every work day has both check-in and check-out. */
export function isAttendanceComplete(
  workDates: string[],
  events: { kind: string; work_date: string }[],
): boolean {
  return attendanceDaysComplete(workDates, events);
}

/** Next scheduled (future) incomplete day, if any. */
export function nextScheduledWorkDay(
  workDates: string[],
  events: { kind: string; work_date: string }[],
  today = localDateISO(),
): string | null {
  const index = buildAttendanceDayIndex(workDates, events);
  for (const date of workDates) {
    if (date <= today) continue;
    if (!index.get(date)?.complete) return date;
  }
  return null;
}

export function formatWorkDatesLabel(dates: string[]) {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return "—";
  if (sorted.length === 1) {
    return parseLocalDate(sorted[0]!).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = daysBetweenISO(first, last);
  const contiguous = span === sorted.length - 1;

  const firstLabel = parseLocalDate(first).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const lastLabel = parseLocalDate(last).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (contiguous) {
    return `${sorted.length} days · ${firstLabel} – ${lastLabel}`;
  }
  return `${sorted.length} days selected`;
}

/** Compact list for sparse schedules, e.g. "Mon 29 Jul, Mon 5 Aug". */
export function formatWorkDatesList(dates: string[], max = 6) {
  const sorted = [...dates].sort();
  const shown = sorted.slice(0, max).map((d) =>
    parseLocalDate(d).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  );
  const extra = sorted.length - shown.length;
  return extra > 0 ? `${shown.join(" · ")} · +${extra} more` : shown.join(" · ");
}

export function formatWorkDateShort(iso: string) {
  return parseLocalDate(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
