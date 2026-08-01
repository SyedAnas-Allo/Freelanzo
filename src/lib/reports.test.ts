import assert from "node:assert/strict";
import test from "node:test";
import {
  reasonRequiresDetails,
  reportReasonsFor,
  submitReport,
  type ReportsStore,
} from "@/lib/reports";

test("freelancer → business reasons put Other last and exclude business-only keys", () => {
  const reasons = reportReasonsFor("freelancer_to_business");
  assert.equal(reasons.at(-1)?.key, "other");
  assert.equal(
    reasons.some((r) => r.key === "job_mismatch"),
    true,
  );
  assert.equal(
    reasons.some((r) => r.key === "no_show"),
    false,
  );
});

test("business → freelancer reasons put Other last and exclude freelancer-only keys", () => {
  const reasons = reportReasonsFor("business_to_freelancer");
  assert.equal(reasons.at(-1)?.key, "other");
  assert.equal(
    reasons.some((r) => r.key === "no_show"),
    true,
  );
  assert.equal(
    reasons.some((r) => r.key === "job_mismatch"),
    false,
  );
});

test("only Other requires details", () => {
  assert.equal(reasonRequiresDetails("other"), true);
  assert.equal(reasonRequiresDetails("safety"), false);
});

test("submitReport blocks duplicates", async () => {
  const store: ReportsStore = {
    findExisting: async () => ({ data: { id: "existing" }, error: null }),
    insert: async () => ({ error: null }),
  };
  const result = await submitReport(store, {
    reporterId: "r1",
    reportedUserId: "u1",
    jobId: "j1",
    applicationId: "a1",
    reason: "safety",
    details: null,
  });
  assert.deepEqual(result, { ok: false, duplicate: true });
});

test("submitReport requires details for Other", async () => {
  const store: ReportsStore = {
    findExisting: async () => ({ data: null, error: null }),
    insert: async () => ({ error: null }),
  };
  const result = await submitReport(store, {
    reporterId: "r1",
    reportedUserId: "u1",
    jobId: "j1",
    applicationId: null,
    reason: "other",
    details: "  ",
  });
  assert.deepEqual(result, {
    ok: false,
    duplicate: false,
    message: "Please add a short note",
  });
});

test("submitReport inserts a trimmed report", async () => {
  const inserted: unknown[] = [];
  const store: ReportsStore = {
    findExisting: async () => ({ data: null, error: null }),
    insert: async (row) => {
      inserted.push(row);
      return { error: null };
    },
  };
  const result = await submitReport(store, {
    reporterId: "r1",
    reportedUserId: "u1",
    jobId: "j1",
    applicationId: "a1",
    reason: "safety",
    details: " Felt unsafe ",
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(inserted, [
    {
      reporterId: "r1",
      reportedUserId: "u1",
      jobId: "j1",
      applicationId: "a1",
      reason: "safety",
      details: "Felt unsafe",
    },
  ]);
});
