import assert from "node:assert/strict";
import test from "node:test";
import { effectiveJobStatus } from "@/lib/status";
import type { Job } from "@/types/database";

function job(overrides: Partial<Job>): Job {
  return {
    status: "live",
    job_date: "2026-08-14",
    work_dates: ["2026-08-14"],
    start_time: "10:00:00",
    end_time: "18:00:00",
    ...overrides,
  } as Job;
}

test("a live gig past its shift reads as expired", () => {
  // The row stays `live` because nothing runs expire_finished_jobs.
  const ended = job({ job_date: "2020-01-01", work_dates: ["2020-01-01"] });
  assert.equal(effectiveJobStatus(ended), "expired");
});

test("an upcoming live gig stays live", () => {
  const upcoming = job({ job_date: "2999-01-01", work_dates: ["2999-01-01"] });
  assert.equal(effectiveJobStatus(upcoming), "live");
});

test("other statuses are never rewritten", () => {
  const past = { job_date: "2020-01-01", work_dates: ["2020-01-01"] };
  assert.equal(effectiveJobStatus(job({ ...past, status: "completed" })), "completed");
  assert.equal(effectiveJobStatus(job({ ...past, status: "cancelled" })), "cancelled");
  assert.equal(
    effectiveJobStatus(job({ ...past, status: "in_progress" })),
    "in_progress",
  );
});

test("legacy rows without work_dates fall back to job_date", () => {
  assert.equal(
    effectiveJobStatus(job({ job_date: "2020-01-01", work_dates: null })),
    "expired",
  );
});
