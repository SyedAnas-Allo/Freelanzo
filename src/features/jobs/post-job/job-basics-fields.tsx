"use client";

import {
  Briefcase,
  IndianRupee,
  LayoutGrid,
  Minus,
  Plus,
  Sparkles,
  Users,
  VenusAndMars,
  Wallet,
} from "lucide-react";
import {
  FormField,
  formControlClassName,
  formSelectTriggerClassName,
} from "@/components/forms/form-field";
import { FormGroup } from "@/components/forms/form-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, formatPay, jobDayTotal, jobEngagementTotal } from "@/lib/utils";
import type { JobCategory, JobGenderPreference } from "@/types/database";
import type { PostJobFormController } from "./use-post-job-form";

export function JobBasicsFields({
  controller: { form, setForm },
}: {
  controller: PostJobFormController;
}) {
  return (
    <>
      <FormGroup>
        <FormField icon={Briefcase} label="Gig Title" required>
          <Input
            className={formControlClassName}
            placeholder="Enter a gig title"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
          />
          {!form.title.trim() ? (
            <p className="mt-1 text-[11px] font-light text-muted-foreground">
              e.g. &quot;Restaurant Staff&quot;, &quot;Promoter&quot;,
              &quot;Volunteer&quot;, &quot;Hostess&quot;
            </p>
          ) : null}
        </FormField>

        <FormField icon={LayoutGrid} label="Category" required>
          <Select
            value={form.category}
            onValueChange={(category) =>
              setForm((current) => ({
                ...current,
                category: category as JobCategory,
              }))
            }
          >
            <SelectTrigger className={formSelectTriggerClassName}>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.filter((category) => category.value !== "all").map(
                (category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          icon={Users}
          label="Number of Freelancers"
          required
          action={
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-7 rounded-full"
                aria-label="Remove one freelancer"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    headcount: Math.max(1, current.headcount - 1),
                  }))
                }
              >
                <Minus className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-7 rounded-full"
                aria-label="Add one freelancer"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    headcount: current.headcount + 1,
                  }))
                }
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          }
        >
          <p className="text-[15px] font-bold">{form.headcount}</p>
        </FormField>

        <FormField icon={Sparkles} label="Skill level">
          <Select
            value={form.skilled ? "skilled" : "unskilled"}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                skilled: value === "skilled",
              }))
            }
          >
            <SelectTrigger className={formSelectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unskilled">Unskilled</SelectItem>
              <SelectItem value="skilled">Skilled</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField icon={VenusAndMars} label="Gender preference">
          <Select
            value={form.gender_preference}
            onValueChange={(genderPreference) =>
              setForm((current) => ({
                ...current,
                gender_preference: genderPreference as JobGenderPreference,
              }))
            }
          >
            <SelectTrigger className={formSelectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FormGroup>

      <FormGroup>
        <FormField icon={IndianRupee} label="Pay per Day (base pay)" required>
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold">₹</span>
            <Input
              type="number"
              min={0}
              className={formControlClassName}
              placeholder="Enter amount"
              value={form.pay_per_freelancer || ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  pay_per_freelancer: Number(event.target.value) || 0,
                }))
              }
            />
          </div>
        </FormField>

        <FormField icon={Wallet} label="Allowances per day (₹)">
          <div className="mt-1 grid grid-cols-2 gap-3">
            <AllowanceInput
              label="Food"
              value={form.food_allowance_inr}
              onChange={(food_allowance_inr) =>
                setForm((current) => ({ ...current, food_allowance_inr }))
              }
            />
            <AllowanceInput
              label="Travel"
              value={form.travel_allowance_inr}
              onChange={(travel_allowance_inr) =>
                setForm((current) => ({ ...current, travel_allowance_inr }))
              }
            />
          </div>
        </FormField>
      </FormGroup>

      {form.food_allowance_inr > 0 ||
      form.travel_allowance_inr > 0 ||
      form.work_dates.length > 1 ? (
        <p className="px-1 text-[13px] font-semibold text-emerald-700">
          {formatPay(jobDayTotal(form))} / day
          {form.work_dates.length > 1
            ? ` · ${formatPay(jobEngagementTotal(form))} total for ${form.work_dates.length} days (paid once)`
            : null}
        </p>
      ) : null}
    </>
  );
}

function AllowanceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
      <div className="flex h-9 items-center rounded-full border border-border/70 bg-muted/30 p-0.5">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground"
          disabled={value === 0}
          onClick={() => onChange(Math.max(0, value - 50))}
        >
          <Minus className="size-3.5" />
        </button>
        <Input
          type="number"
          min={0}
          step={50}
          aria-label={`${label} allowance in rupees`}
          className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-sm font-bold shadow-none focus-visible:ring-0"
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        />
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-primary"
          onClick={() => onChange(value + 50)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
