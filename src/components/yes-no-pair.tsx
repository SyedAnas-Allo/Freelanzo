"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function YesNoActionPair({
  yesLabel,
  noLabel,
  value,
  onChange,
  disabled,
  className,
}: {
  yesLabel: string;
  noLabel: string;
  value: "yes" | "no" | null;
  onChange: (v: "yes" | "no") => void;
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "yes"}
        onClick={() => onChange("yes")}
        className={cn(
          base,
          "focus-visible:ring-emerald-500/20",
          value === "yes"
            ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
            : "border-emerald-300 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300",
        )}
      >
        <Check className="size-4" strokeWidth={2.5} />
        {yesLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "no"}
        onClick={() => onChange("no")}
        className={cn(
          base,
          "focus-visible:ring-ring/50",
          value === "no"
            ? "border-foreground/40 bg-muted text-foreground ring-1 ring-foreground/30"
            : "border-border bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        <X className="size-4" strokeWidth={2.5} />
        {noLabel}
      </button>
    </div>
  );
}
