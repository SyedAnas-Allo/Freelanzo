import assert from "node:assert/strict";
import test from "node:test";
import { notificationHref } from "@/lib/notification-href";
import type { Notification } from "@/types/database";

function notification(
  type: string,
  meta: Notification["meta"],
): Notification {
  return {
    id: "notification-id",
    user_id: "user-id",
    type,
    title: "Attendance",
    body: null,
    meta,
    read_at: null,
    created_at: "2026-08-14T10:00:00.000Z",
  };
}

test("attendance request opens the correct business queue", () => {
  const item = notification("attendance_request", {
    job_id: "job-id",
    kind: "check_out",
    work_date: "2026-08-14",
  });

  assert.equal(
    notificationHref(item, "business"),
    "/business/jobs/job-id/attendance?kind=check_out&date=2026-08-14",
  );
});

test("rejected attendance opens freelancer resubmission", () => {
  const item = notification("attendance_rejected", {
    job_id: "job-id",
    kind: "check_in",
    work_date: "2026-08-14",
  });

  assert.equal(
    notificationHref(item, "freelancer"),
    "/freelancer/jobs/job-id/check-in?date=2026-08-14",
  );
});
