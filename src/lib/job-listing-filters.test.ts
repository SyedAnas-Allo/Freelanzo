import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_JOB_LISTING_FILTERS,
  filterJobs,
  jobShift,
  parseJobListingFilters,
} from "@/lib/job-listing-filters";
import type { Job } from "@/types/database";

type NearbyJob = Job & { distanceKm: number };

function job(overrides: Partial<NearbyJob> = {}): NearbyJob {
  return {
    id: "job",
    skilled: false,
    job_date: "2026-08-15",
    work_dates: ["2026-08-15"],
    start_time: "09:00:00",
    pay_per_freelancer: 600,
    food_allowance_inr: 100,
    travel_allowance_inr: 0,
    distanceKm: 2,
    ...overrides,
  } as NearbyJob;
}

test("parses valid filters and ignores invalid URL values", () => {
  const params = new URLSearchParams(
    "minPay=500&maxPay=-1&dateFrom=2026-08-15&dateTo=soon&skill=skilled&shift=late&gender=male&sort=highest_pay",
  );

  assert.deepEqual(parseJobListingFilters(params), {
    minPay: 500,
    maxPay: null,
    dateFrom: "2026-08-15",
    dateTo: null,
    skill: "skilled",
    shift: "all",
    gender: "male",
  });
});

test("filters on displayed daily pay including allowances", () => {
  const jobs = [
    job({ id: "included", pay_per_freelancer: 600, food_allowance_inr: 100 }),
    job({ id: "excluded", pay_per_freelancer: 499, food_allowance_inr: 0 }),
  ];

  const result = filterJobs(jobs, {
    ...DEFAULT_JOB_LISTING_FILTERS,
    minPay: 500,
    maxPay: 700,
  });

  assert.deepEqual(
    result.map((item) => item.id),
    ["included"],
  );
});

test("matches any selected work date in the requested range", () => {
  const jobs = [
    job({
      id: "multi-day",
      job_date: "2026-08-15",
      work_dates: ["2026-08-15", "2026-08-20"],
    }),
    job({ id: "outside", job_date: "2026-08-16", work_dates: null }),
  ];

  const result = filterJobs(jobs, {
    ...DEFAULT_JOB_LISTING_FILTERS,
    dateFrom: "2026-08-19",
    dateTo: "2026-08-21",
  });

  assert.deepEqual(
    result.map((item) => item.id),
    ["multi-day"],
  );
});

test("filters by skill and shiftLabel buckets", () => {
  const jobs = [
    job({ id: "match", skilled: true, start_time: "18:00:00" }),
    job({ id: "wrong-skill", skilled: false, start_time: "18:00:00" }),
    job({ id: "wrong-shift", skilled: true, start_time: "10:00:00" }),
  ];

  const result = filterJobs(jobs, {
    ...DEFAULT_JOB_LISTING_FILTERS,
    skill: "skilled",
    shift: "evening",
  });

  assert.deepEqual(
    result.map((item) => item.id),
    ["match"],
  );
  assert.equal(jobShift("10:00:00"), "morning");
  assert.equal(jobShift("12:00:00"), "lunch");
  assert.equal(jobShift("18:00:00"), "evening");
  assert.equal(jobShift("21:00:00"), "night");
});

test("filters by exact job gender preference", () => {
  const jobs = [
    job({ id: "male", gender_preference: "male" }),
    job({ id: "female", gender_preference: "female" }),
    job({ id: "any", gender_preference: "any" }),
  ];

  assert.deepEqual(
    filterJobs(jobs, {
      ...DEFAULT_JOB_LISTING_FILTERS,
      gender: "male",
    }).map((item) => item.id),
    ["male"],
  );
  assert.deepEqual(
    filterJobs(jobs, {
      ...DEFAULT_JOB_LISTING_FILTERS,
      gender: "any",
    }).map((item) => item.id),
    ["any"],
  );
});

test("preserves input order after filtering", () => {
  const jobs = [
    job({ id: "near", distanceKm: 1 }),
    job({ id: "far", distanceKm: 3, pay_per_freelancer: 200 }),
  ];

  assert.deepEqual(
    filterJobs(jobs, DEFAULT_JOB_LISTING_FILTERS).map((item) => item.id),
    ["near", "far"],
  );
});
