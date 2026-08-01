"use client";

import { cn } from "@/lib/utils";
import { formatWorkDateShort, localDateISO } from "@/lib/work-dates";

/** Horizontal day chips for multi-day attendance. */
export function WorkDayChips({
  dates,
  value,
  onChange,
  doneDates,
}: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  /** Dates where both check-in and check-out are done (optional greying). */
  doneDates?: Set<string>;
}) {
  const today = localDateISO();
  if (dates.length <= 1) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
      {dates.map((d, i) => {
        const active = d === value;
        const done = doneDates?.has(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1.5 text-left transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/80 text-secondary-foreground hover:bg-secondary",
              done && !active && "opacity-60",
            )}
          >
            <p className="text-[10px] font-semibold opacity-80">
              Day {i + 1}
              {d === today ? " · Today" : ""}
            </p>
            <p className="text-[11px] font-bold leading-tight">
              {formatWorkDateShort(d)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
