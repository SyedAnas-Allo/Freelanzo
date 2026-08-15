import assert from "node:assert/strict";
import test from "node:test";
import {
  formatJobDateRelative,
  jobTimingTag,
} from "@/features/jobs/formatters/job-date";

test("relative labels cover today, tomorrow, and in N days", () => {
  assert.equal(formatJobDateRelative("2026-08-15", "2026-08-15"), "Today");
  assert.equal(formatJobDateRelative("2026-08-16", "2026-08-15"), "Tomorrow");
  assert.equal(formatJobDateRelative("2026-08-18", "2026-08-15"), "in 3 days");
});

test("timing tag uses the next upcoming work day", () => {
  assert.equal(
    jobTimingTag(["2026-08-14", "2026-08-17"], "2026-08-15"),
    "in 2 days",
  );
  assert.equal(jobTimingTag(["2026-08-15"], "2026-08-15"), "Today");
  assert.equal(jobTimingTag(["2026-08-14"], "2026-08-15"), null);
});
