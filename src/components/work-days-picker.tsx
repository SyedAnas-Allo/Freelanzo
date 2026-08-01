"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WORK_DAY_WINDOW,
  addDaysISO,
  localDateISO,
  parseLocalDate,
  toggleWorkDay,
} from "@/lib/work-dates";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function cellsForMonth(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(localDateISO(new Date(year, month, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function WorkDaysPicker({
  value,
  onChange,
  minDate,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  /** Earliest selectable day (defaults to today). */
  minDate?: string;
}) {
  const today = localDateISO();
  const floor = minDate ?? today;
  const sorted = useMemo(() => [...value].sort(), [value]);
  const anchor = sorted[0] ?? null;
  const windowEnd = anchor ? addDaysISO(anchor, WORK_DAY_WINDOW - 1) : null;

  const initial = parseLocalDate(sorted[0] ?? today);
  const [cursor, setCursor] = useState({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });

  const cells = cellsForMonth(cursor.year, cursor.month);

  function select(day: string) {
    if (day < floor) {
      toast.error("Pick today or a future day");
      return;
    }
    if (anchor && !sorted.includes(day)) {
      if (day > windowEnd!) {
        toast.error(
          `Days must be within ${WORK_DAY_WINDOW} days of ${parseLocalDate(anchor).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        );
        return;
      }
      if (day < anchor) {
        // New earlier day becomes anchor — check window against existing last
        const last = sorted[sorted.length - 1]!;
        if (
          daysSpan(day, last) > WORK_DAY_WINDOW - 1
        ) {
          toast.error(
            `Selecting this day would push later days past the ${WORK_DAY_WINDOW}-day window`,
          );
          return;
        }
      }
    }
    const result = toggleWorkDay(sorted, day);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onChange(result.dates);
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-lg"
          onClick={() =>
            setCursor((c) => {
              const m = c.month - 1;
              return m < 0
                ? { year: c.year - 1, month: 11 }
                : { year: c.year, month: m };
            })
          }
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-bold">{monthLabel(cursor.year, cursor.month)}</p>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-lg"
          onClick={() =>
            setCursor((c) => {
              const m = c.month + 1;
              return m > 11
                ? { year: c.year + 1, month: 0 }
                : { year: c.year, month: m };
            })
          }
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const selected = sorted.includes(day);
          const past = day < floor;
          const outsideWindow =
            !!anchor &&
            !selected &&
            (day > windowEnd! ||
              (day < anchor &&
                sorted.length > 0 &&
                daysSpan(day, sorted[sorted.length - 1]!) >
                  WORK_DAY_WINDOW - 1));
          const disabled = past || outsideWindow;

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => select(day)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-[12px] font-semibold transition-colors",
                selected && "bg-primary text-primary-foreground",
                !selected &&
                  !disabled &&
                  "hover:bg-primary/10 text-foreground",
                disabled && "cursor-not-allowed text-muted-foreground/35",
                day === today && !selected && "ring-1 ring-primary/40",
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">
        Tap days you need staff. First day starts a {WORK_DAY_WINDOW}-day
        window — skip days you don’t need (e.g. only Mondays). Same hours every
        day · pay once when all days are done.
      </p>

      {sorted.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sorted.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => select(d)}
              className="inline-flex h-6 items-center rounded-md bg-primary/10 px-2 text-[10px] font-bold text-primary"
            >
              {parseLocalDate(d).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              <span className="ml-1 opacity-60">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function daysSpan(a: string, b: string) {
  return Math.round(
    (parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000,
  );
}
