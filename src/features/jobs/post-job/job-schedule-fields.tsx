"use client";

import { CalendarDays, Clock, MapPin } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { FormGroup } from "@/components/forms/form-group";
import { LocationPickerLazy } from "@/components/location-picker-lazy";
import { WorkDaysPicker } from "@/components/work-days-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  postJobTimeOptions,
  type PostJobFormController,
} from "./use-post-job-form";

export function JobScheduleFields({
  controller,
}: {
  controller: PostJobFormController;
}) {
  const {
    form,
    setForm,
    location,
    setLocation,
    showDays,
    setShowDays,
    showMap,
    setShowMap,
    daysLabel,
    defaultLocation,
  } = controller;

  return (
    <FormGroup>
      <div className="px-3.5 py-3">
        <FieldHeader
          icon={CalendarDays}
          label="Work days"
          value={daysLabel}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setShowDays((visible) => !visible)}
            >
              {showDays ? "Hide" : "Change"}
            </Button>
          }
        />
        {showDays ? (
          <div className="mt-3">
            <WorkDaysPicker
              value={form.work_dates}
              onChange={(work_dates) =>
                setForm((current) => ({ ...current, work_dates }))
              }
            />
          </div>
        ) : null}
      </div>

      <FormField icon={Clock} label="Work Time" required>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <TimeSelect
            label="Starts"
            value={form.start_time}
            onChange={(start_time) =>
              setForm((current) => ({ ...current, start_time }))
            }
          />
          <span className="pb-2.5 text-sm text-muted-foreground">–</span>
          <TimeSelect
            label="Ends"
            value={form.end_time}
            onChange={(end_time) =>
              setForm((current) => ({ ...current, end_time }))
            }
          />
        </div>
      </FormField>

      <div className="px-3.5 py-3">
        <FieldHeader
          icon={MapPin}
          label="Gig Location"
          value={
            location
              ? [location.area, location.city].filter(Boolean).join(", ") ||
                "Choose a location"
              : "Choose a location"
          }
          action={
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setShowMap((visible) => !visible)}
            >
              {showMap ? "Hide" : location ? "Change" : "Add"}
            </Button>
          }
        />
        {showMap ? (
          <div className="mt-3 space-y-2">
            <LocationPickerLazy
              value={location ?? defaultLocation()}
              onChange={(next) => {
                const nextAddress = [next.area, next.city]
                  .filter(Boolean)
                  .join(", ");
                const previousAuto = location
                  ? [location.area, location.city].filter(Boolean).join(", ")
                  : "";
                setLocation(next);
                setForm((current) => {
                  const shouldUpdateAddress =
                    !current.address.trim() || current.address === previousAuto;
                  return {
                    ...current,
                    address: shouldUpdateAddress
                      ? nextAddress
                      : current.address,
                  };
                });
              }}
              showRadius={false}
              height={180}
            />
            <Input
              className="h-11 rounded-xl"
              placeholder="Full address"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />
          </div>
        ) : null}
      </div>
    </FormGroup>
  );
}

function FieldHeader({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-light text-muted-foreground">
            {label} <span className="text-destructive">*</span>
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold">{value}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={`${label} at`}
          className="h-10 w-full rounded-xl border-border/70 bg-muted/30 px-3 text-sm font-bold shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="max-h-64">
          {postJobTimeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
