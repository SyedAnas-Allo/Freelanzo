import { daysBetweenISO, localDateISO } from "@/lib/work-dates";

export function formatJobDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

/** Client-only relative label. Use absolute dates for server-rendered text. */
export function formatJobDateRelative(
  date: string,
  today = localDateISO(),
): string {
  const difference = daysBetweenISO(today, date);

  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  if (difference > 1) return `in ${difference} days`;
  return formatJobDate(date);
}

/**
 * Timing tag for job cards / listings based on the next upcoming work day.
 * Returns null when every work day is in the past.
 */
export function jobTimingTag(
  workDates: string[],
  today = localDateISO(),
): string | null {
  const next = workDates.find((date) => date >= today);
  if (!next) return null;
  return formatJobDateRelative(next, today);
}
