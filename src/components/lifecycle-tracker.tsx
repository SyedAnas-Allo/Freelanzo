import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Check,
  LogIn,
  LogOut,
  Send,
  Star,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ApplicationLifecycle,
  JobLifecycleSummary,
  MilestoneId,
  MilestoneView,
} from "@/lib/application-lifecycle";

const MILESTONE_ICONS: Record<
  MilestoneId,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  applied: Send,
  selected: UserCheck,
  check_in: LogIn,
  check_out: LogOut,
  payment: Banknote,
  rating: Star,
};

function MilestoneDot({ milestone }: { milestone: MilestoneView }) {
  const isDone = milestone.state === "completed";
  const isCurrent = milestone.state === "current";
  const isException = milestone.state === "exception";
  const Icon = MILESTONE_ICONS[milestone.id];

  return (
    <div className="flex w-0 min-w-0 flex-1 flex-col items-center gap-1">
      <span
        className={cn(
          "relative z-[1] flex size-6 items-center justify-center rounded-full border-2",
          isDone && "border-emerald-500 bg-emerald-500 text-white",
          isCurrent &&
            "border-dashed border-primary bg-background text-primary ring-4 ring-primary/10",
          isException && "border-amber-500 bg-amber-500 text-white",
          !isDone &&
            !isCurrent &&
            !isException &&
            "border-transparent bg-muted text-muted-foreground/70",
        )}
        aria-current={isCurrent || isException ? "step" : undefined}
        aria-label={`${milestone.label}: ${
          isDone
            ? "done"
            : isException
              ? "needs attention"
              : isCurrent
                ? "in progress"
                : "not started"
        }`}
      >
        {isDone ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : isException ? (
          <AlertTriangle className="size-3" strokeWidth={2.5} />
        ) : (
          <Icon className="size-3" strokeWidth={2.5} />
        )}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-center text-[9px] font-bold leading-tight",
          isException
            ? "text-amber-700"
            : isCurrent
              ? "text-primary"
              : isDone
                ? "text-emerald-700"
                : "text-muted-foreground",
        )}
      >
        {milestone.label}
      </span>
      {milestone.detail ? (
        <span className="text-[8px] font-semibold text-muted-foreground">
          {milestone.detail}
        </span>
      ) : null}
    </div>
  );
}

export function LifecycleTracker({
  lifecycle,
  className,
  showCta = true,
}: {
  lifecycle: ApplicationLifecycle;
  className?: string;
  showCta?: boolean;
}) {
  const steps = lifecycle.milestones;
  const doneCount = steps.filter((m) => m.state === "completed").length;
  // Track spans the dot centres, from 8% to 92% of the row.
  const filledWidth =
    steps.length > 1
      ? (84 * Math.max(doneCount - 1, 0)) / (steps.length - 1)
      : 0;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="relative flex items-start justify-between gap-1">
        <div
          className="pointer-events-none absolute left-[8%] right-[8%] top-3 h-0.5 bg-border"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-[8%] top-3 h-0.5 bg-emerald-500"
          style={{ width: `${filledWidth}%` }}
          aria-hidden
        />
        {steps.map((m) => (
          <MilestoneDot key={m.id} milestone={m} />
        ))}
      </div>

      <p
        className={cn(
          "text-[11px] font-semibold",
          lifecycle.exception === "missed_attendance" ||
            lifecycle.exception === "payment_dispute"
            ? "text-amber-700"
            : "text-muted-foreground",
        )}
      >
        {lifecycle.statusText}
      </p>

      {showCta && lifecycle.cta ? (
        lifecycle.cta.kind === "waiting" || lifecycle.cta.kind === "done" ? (
          <div
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold",
              lifecycle.cta.kind === "done"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted/60 text-muted-foreground",
            )}
          >
            {lifecycle.cta.label}
          </div>
        ) : (
          <Link
            href={lifecycle.cta.href}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition-colors",
              lifecycle.cta.kind === "primary"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-primary/25 text-primary hover:bg-primary/5",
            )}
          >
            {lifecycle.cta.label}
          </Link>
        )
      ) : null}
    </div>
  );
}

export function JobLifecycleSummaryBar({
  summary,
  className,
}: {
  summary: JobLifecycleSummary;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-4 gap-1 text-center">
        <div>
          <p className="text-[13px] font-extrabold text-foreground">
            {summary.selected}/{summary.headcount}
          </p>
          <p className="text-[9px] font-semibold text-muted-foreground">
            Selected
          </p>
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-foreground">
            {summary.attendanceComplete}/{summary.selected || "–"}
          </p>
          <p className="text-[9px] font-semibold text-muted-foreground">Done</p>
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-foreground">
            {summary.paid}
            {summary.disputed > 0 ? (
              <span className="text-amber-600">/{summary.disputed}!</span>
            ) : null}
          </p>
          <p className="text-[9px] font-semibold text-muted-foreground">Paid</p>
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-foreground">
            {summary.rated}/{summary.selected || "–"}
          </p>
          <p className="text-[9px] font-semibold text-muted-foreground">Rated</p>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-muted-foreground">
        {summary.statusText}
      </p>
      {summary.cta ? (
        <Link
          href={summary.cta.href}
          className={cn(
            "flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition-colors",
            summary.cta.kind === "primary"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-primary/25 text-primary hover:bg-primary/5",
          )}
        >
          {summary.cta.label}
        </Link>
      ) : null}
    </div>
  );
}
