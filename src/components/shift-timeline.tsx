import { cn, formatTime } from "@/lib/utils";

function parseMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function durationLabel(start: string, end: string) {
  let mins = parseMinutes(end) - parseMinutes(start);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function shiftLabel(start: string) {
  const h = Number(start.split(":")[0]);
  if (h < 11) return "Morning";
  if (h < 16) return "Lunch";
  if (h < 20) return "Evening";
  return "Night";
}

/** Day-strip timeline showing where the shift sits — denser than a plain time badge. */
export function ShiftTimeline({
  start,
  end,
  className,
  compact,
}: {
  start: string;
  end: string;
  className?: string;
  compact?: boolean;
}) {
  const dayStart = 6 * 60;
  const dayEnd = 22 * 60;
  const span = dayEnd - dayStart;

  let s = parseMinutes(start);
  let e = parseMinutes(end);
  if (e <= s) e += 24 * 60;

  const clamp = (v: number) => Math.min(dayEnd, Math.max(dayStart, v));
  const left = ((clamp(s) - dayStart) / span) * 100;
  const right = ((clamp(Math.min(e, dayEnd)) - dayStart) / span) * 100;
  const width = Math.max(8, right - left);

  if (compact) {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground">
            {formatTime(start)}
            <span className="mx-1 font-light text-muted-foreground">→</span>
            {formatTime(end)}
          </p>
          <p className="text-[10px] font-medium text-primary">
            {durationLabel(start, end)} · {shiftLabel(start)}
          </p>
        </div>
        <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-sm bg-muted">
          <div
            className="absolute inset-y-0 rounded-sm bg-primary"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-card p-3",
        className,
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Shift window
          </p>
          <p className="mt-0.5 text-lg font-extrabold tracking-tight">
            {formatTime(start)}
            <span className="mx-1.5 text-sm font-light text-muted-foreground">
              to
            </span>
            {formatTime(end)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-light text-muted-foreground">
            {shiftLabel(start)} shift
          </p>
          <p className="text-sm font-bold text-primary">
            {durationLabel(start, end)}
          </p>
        </div>
      </div>

      <div className="relative mt-3 h-2 overflow-hidden rounded-sm bg-muted">
        <div
          className="absolute inset-y-0 rounded-sm bg-primary shadow-[0_0_0_1px_rgba(142,48,255,0.2)]"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-light text-muted-foreground">
        <span>6 AM</span>
        <span>2 PM</span>
        <span>10 PM</span>
      </div>
    </div>
  );
}
