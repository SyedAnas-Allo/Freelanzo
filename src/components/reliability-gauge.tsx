import { cn } from "@/lib/utils";

export function ReliabilityGauge({
  score,
  max = 100,
  label = "Reliability Score",
  className,
  size = "md",
  center,
}: {
  score: number;
  max?: number;
  label?: string;
  className?: string;
  size?: "sm" | "md";
  /** Override the default numeric center content */
  center?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(max, score));
  const pct = clamped / max;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className={cn("relative", size === "sm" ? "size-28" : "size-36")}>
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-secondary"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="text-primary transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {center ?? (
            <p className="text-2xl font-extrabold leading-none text-foreground">
              {Math.round(clamped)}
              <span className="text-sm font-semibold text-muted-foreground">
                /{max}
              </span>
            </p>
          )}
        </div>
      </div>
      {label ? (
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
