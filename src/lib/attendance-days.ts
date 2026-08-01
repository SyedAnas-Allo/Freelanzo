export type AttendanceEventRow = {
  kind: string;
  work_date: string;
};

export type AttendanceDayIndex = {
  date: string;
  checkedIn: boolean;
  checkedOut: boolean;
  complete: boolean;
};

export function buildAttendanceDayIndex(
  workDates: string[],
  events: AttendanceEventRow[],
): Map<string, AttendanceDayIndex> {
  const byDate = new Map<string, AttendanceDayIndex>();
  for (const date of workDates) {
    byDate.set(date, {
      date,
      checkedIn: false,
      checkedOut: false,
      complete: false,
    });
  }
  for (const event of events) {
    const row = byDate.get(event.work_date);
    if (!row) continue;
    if (event.kind === "check_in") row.checkedIn = true;
    if (event.kind === "check_out") row.checkedOut = true;
  }
  for (const row of byDate.values()) {
    row.complete = row.checkedIn && row.checkedOut;
  }
  return byDate;
}

export function attendanceDaysComplete(
  workDates: string[],
  events: AttendanceEventRow[],
): boolean {
  if (workDates.length === 0) return false;
  const index = buildAttendanceDayIndex(workDates, events);
  return workDates.every((date) => index.get(date)?.complete);
}

export function completedWorkDates(
  workDates: string[],
  events: AttendanceEventRow[],
): Set<string> {
  const index = buildAttendanceDayIndex(workDates, events);
  const done = new Set<string>();
  for (const date of workDates) {
    if (index.get(date)?.complete) done.add(date);
  }
  return done;
}

export function attendanceProgressLabel(
  checkOutDone: number,
  totalDays: number,
): string {
  return `${checkOutDone}/${totalDays} days complete`;
}
