import assert from "node:assert/strict";
import test from "node:test";
import { isJobScheduleOpen, jobApplicationDeadline } from "@/lib/work-dates";

test("applications close when the last shift ends", () => {
  assert.deepEqual(
    jobApplicationDeadline(["2026-08-14"], "10:00", "18:00"),
    new Date("2026-08-14T18:00:00"),
  );
  assert.deepEqual(
    jobApplicationDeadline(["2026-08-14", "2026-08-16"], "10:00", "18:00"),
    new Date("2026-08-16T18:00:00"),
  );
});

test("an overnight shift ends on the following day", () => {
  assert.deepEqual(
    jobApplicationDeadline(["2026-08-14"], "22:00", "06:00"),
    new Date("2026-08-15T06:00:00"),
  );
  assert.deepEqual(
    jobApplicationDeadline(["2026-08-14"], "16:00", "00:00"),
    new Date("2026-08-15T00:00:00"),
  );
});

test("times from the database carry seconds", () => {
  assert.deepEqual(
    jobApplicationDeadline(["2026-08-14"], "10:00:00", "18:00:00"),
    new Date("2026-08-14T18:00:00"),
  );
});

test("a gig posted after its shift ended is already closed", () => {
  const evening = new Date("2026-08-14T20:58:00");

  assert.equal(
    isJobScheduleOpen(["2026-08-14"], "10:00", "18:00", evening),
    false,
  );
  assert.equal(
    isJobScheduleOpen(["2026-08-15"], "10:00", "18:00", evening),
    true,
  );
  assert.equal(
    isJobScheduleOpen(["2026-08-14"], "22:00", "06:00", evening),
    true,
  );
  assert.equal(isJobScheduleOpen([], "10:00", "18:00", evening), false);
});
