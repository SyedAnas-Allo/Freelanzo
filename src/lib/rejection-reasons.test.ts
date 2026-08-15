import assert from "node:assert/strict";
import test from "node:test";
import {
  REJECTION_REASON_OPTIONS,
  rejectionReasonRequiresDetails,
  resolveRejectionReason,
} from "@/lib/rejection-reasons";

test("rejection reasons keep Other last", () => {
  assert.equal(REJECTION_REASON_OPTIONS.at(-1)?.key, "other");
  assert.ok(REJECTION_REASON_OPTIONS.length >= 4);
});

test("only Other requires details", () => {
  assert.equal(rejectionReasonRequiresDetails("other"), true);
  assert.equal(rejectionReasonRequiresDetails("better_fit"), false);
  assert.equal(rejectionReasonRequiresDetails(null), false);
});

test("resolveRejectionReason uses preset labels and Other text", () => {
  assert.equal(resolveRejectionReason("better_fit", ""), "Found a better fit");
  assert.equal(resolveRejectionReason("other", "  Schedule conflict  "), "Schedule conflict");
  assert.equal(resolveRejectionReason("other", "   "), null);
  assert.equal(resolveRejectionReason(null, "x"), null);
});
