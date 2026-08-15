import { shiftLabel } from "@/components/shift-timeline";
import { jobDayTotal } from "@/lib/utils";
import { jobWorkDates } from "@/lib/work-dates";
import type { Job, JobGenderPreference } from "@/types/database";

export type JobSkillFilter = "all" | "skilled" | "unskilled";
/** Matches `shiftLabel()` buckets shown on job cards. */
export type JobShiftFilter =
  | "all"
  | "morning"
  | "lunch"
  | "evening"
  | "night";
export type JobGenderFilter = "all" | JobGenderPreference;

export type JobListingFilters = {
  minPay: number | null;
  maxPay: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  skill: JobSkillFilter;
  shift: JobShiftFilter;
  gender: JobGenderFilter;
};

export const DEFAULT_JOB_LISTING_FILTERS: JobListingFilters = {
  minPay: null,
  maxPay: null,
  dateFrom: null,
  dateTo: null,
  skill: "all",
  shift: "all",
  gender: "all",
};

const SKILL_FILTERS = new Set<JobSkillFilter>([
  "all",
  "skilled",
  "unskilled",
]);
const SHIFT_FILTERS = new Set<JobShiftFilter>([
  "all",
  "morning",
  "lunch",
  "evening",
  "night",
]);
const GENDER_FILTERS = new Set<JobGenderFilter>([
  "all",
  "any",
  "male",
  "female",
]);
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseAmount(value: string | null) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseDate(value: string | null) {
  return value && LOCAL_DATE_PATTERN.test(value) ? value : null;
}

export function parseJobListingFilters(
  searchParams: Pick<URLSearchParams, "get">,
): JobListingFilters {
  const skill = searchParams.get("skill") as JobSkillFilter | null;
  const shift = searchParams.get("shift") as JobShiftFilter | null;
  const gender = searchParams.get("gender") as JobGenderFilter | null;

  return {
    minPay: parseAmount(searchParams.get("minPay")),
    maxPay: parseAmount(searchParams.get("maxPay")),
    dateFrom: parseDate(searchParams.get("dateFrom")),
    dateTo: parseDate(searchParams.get("dateTo")),
    skill: skill && SKILL_FILTERS.has(skill) ? skill : "all",
    shift: shift && SHIFT_FILTERS.has(shift) ? shift : "all",
    gender: gender && GENDER_FILTERS.has(gender) ? gender : "all",
  };
}

export function countActiveJobFilters(filters: JobListingFilters) {
  return [
    filters.minPay !== null || filters.maxPay !== null,
    filters.dateFrom !== null || filters.dateTo !== null,
    filters.skill !== "all",
    filters.shift !== "all",
    filters.gender !== "all",
  ].filter(Boolean).length;
}

export function jobShift(
  startTime: string,
): Exclude<JobShiftFilter, "all"> {
  return shiftLabel(startTime).toLowerCase() as Exclude<JobShiftFilter, "all">;
}

export function filterJobs<T extends Job>(jobs: T[], filters: JobListingFilters) {
  return jobs.filter((job) => {
    const pay = jobDayTotal(job);
    if (filters.minPay !== null && pay < filters.minPay) return false;
    if (filters.maxPay !== null && pay > filters.maxPay) return false;

    if (
      filters.skill !== "all" &&
      job.skilled !== (filters.skill === "skilled")
    ) {
      return false;
    }

    if (filters.shift !== "all" && jobShift(job.start_time) !== filters.shift) {
      return false;
    }

    if (
      filters.gender !== "all" &&
      job.gender_preference !== filters.gender
    ) {
      return false;
    }

    if (filters.dateFrom !== null || filters.dateTo !== null) {
      const hasMatchingDate = jobWorkDates(job).some(
        (date) =>
          (filters.dateFrom === null || date >= filters.dateFrom) &&
          (filters.dateTo === null || date <= filters.dateTo),
      );
      if (!hasMatchingDate) return false;
    }

    return true;
  });
}
