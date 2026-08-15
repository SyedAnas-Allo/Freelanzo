"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRouter } from "@/hooks/use-app-router";
import {
  countActiveJobFilters,
  DEFAULT_JOB_LISTING_FILTERS,
  type JobGenderFilter,
  type JobListingFilters,
  type JobShiftFilter,
  type JobSkillFilter,
} from "@/lib/job-listing-filters";
import { cn } from "@/lib/utils";

const SKILL_OPTIONS: { value: JobSkillFilter; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "unskilled", label: "General" },
  { value: "skilled", label: "Skilled" },
];

const SHIFT_OPTIONS: { value: JobShiftFilter; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "morning", label: "Morning" },
  { value: "lunch", label: "Lunch" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

const GENDER_OPTIONS: { value: JobGenderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "any", label: "Any gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

function ChoiceRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function setOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null,
) {
  if (value === null || value === "" || value === "all") {
    params.delete(key);
  } else {
    params.set(key, String(value));
  }
}

export function JobListingFilters({
  filters,
  searchParams,
}: {
  filters: JobListingFilters;
  searchParams: Pick<URLSearchParams, "toString">;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const activeCount = countActiveJobFilters(filters);
  const draftActiveCount = countActiveJobFilters(draft);
  const invalidPayRange =
    draft.minPay !== null &&
    draft.maxPay !== null &&
    draft.minPay > draft.maxPay;
  const invalidDateRange =
    draft.dateFrom !== null &&
    draft.dateTo !== null &&
    draft.dateFrom > draft.dateTo;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setDraft(filters);
    setOpen(nextOpen);
  }

  function navigate(next: JobListingFilters) {
    const params = new URLSearchParams(searchParams.toString());
    setOptionalParam(params, "minPay", next.minPay);
    setOptionalParam(params, "maxPay", next.maxPay);
    setOptionalParam(params, "dateFrom", next.dateFrom);
    setOptionalParam(params, "dateTo", next.dateTo);
    setOptionalParam(params, "skill", next.skill);
    setOptionalParam(params, "shift", next.shift);
    setOptionalParam(params, "gender", next.gender);
    params.delete("sort");
    const query = params.toString();
    router.replace(query ? `/freelancer?${query}` : "/freelancer", {
      scroll: false,
    });
  }

  function apply() {
    if (invalidPayRange || invalidDateRange) return;
    navigate(draft);
    setOpen(false);
  }

  function clear() {
    setDraft(DEFAULT_JOB_LISTING_FILTERS);
    navigate(DEFAULT_JOB_LISTING_FILTERS);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant={activeCount > 0 ? "secondary" : "outline"}
        size="sm"
        onClick={() => handleOpenChange(true)}
        aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ""}`}
      >
        <SlidersHorizontal data-icon="inline-start" />
        Filters
        {activeCount > 0 ? (
          <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b border-border/60 pb-3">
            <SheetTitle className="text-left text-lg font-extrabold">
              Filter gigs
            </SheetTitle>
            <SheetDescription className="text-left">
              Narrow the list by pay, work dates, skill, shift, or gender.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 py-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Pay per day</legend>
              <p className="text-xs text-muted-foreground">
                Includes food and travel allowances.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Minimum
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Any"
                      value={draft.minPay ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          minPay:
                            event.target.value === ""
                              ? null
                              : Math.max(0, Number(event.target.value)),
                        }))
                      }
                      className="pl-7"
                    />
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Maximum
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Any"
                      value={draft.maxPay ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          maxPay:
                            event.target.value === ""
                              ? null
                              : Math.max(0, Number(event.target.value)),
                        }))
                      }
                      className="pl-7"
                      aria-invalid={invalidPayRange}
                    />
                  </div>
                </label>
              </div>
              {invalidPayRange ? (
                <p className="text-xs font-medium text-destructive">
                  Maximum pay must be at least the minimum.
                </p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Work dates</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    From
                  </span>
                  <Input
                    type="date"
                    value={draft.dateFrom ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dateFrom: event.target.value || null,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    To
                  </span>
                  <Input
                    type="date"
                    min={draft.dateFrom ?? undefined}
                    value={draft.dateTo ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dateTo: event.target.value || null,
                      }))
                    }
                  />
                </label>
              </div>
              {invalidDateRange ? (
                <p className="text-xs font-medium text-destructive">
                  End date must be on or after the start date.
                </p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Skill level</legend>
              <ChoiceRow
                value={draft.skill}
                options={SKILL_OPTIONS}
                onChange={(skill) =>
                  setDraft((current) => ({ ...current, skill }))
                }
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Gender preference</legend>
              <ChoiceRow
                value={draft.gender}
                options={GENDER_OPTIONS}
                onChange={(gender) =>
                  setDraft((current) => ({ ...current, gender }))
                }
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Shift</legend>
              <ChoiceRow
                value={draft.shift}
                options={SHIFT_OPTIONS}
                onChange={(shift) =>
                  setDraft((current) => ({ ...current, shift }))
                }
              />
            </fieldset>
          </div>

          <SheetFooter className="sticky bottom-0 border-t border-border/60 bg-popover pt-3">
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={clear}
                disabled={draftActiveCount === 0}
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={apply}
                disabled={invalidPayRange || invalidDateRange}
              >
                Show gigs
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
