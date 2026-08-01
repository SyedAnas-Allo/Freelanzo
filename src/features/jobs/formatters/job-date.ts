export function formatJobDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

/** Client-only relative label. Use absolute dates for server-rendered text. */
export function formatJobDateRelative(date: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  const difference = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  return formatJobDate(date);
}
