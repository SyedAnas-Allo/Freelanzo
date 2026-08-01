import assert from "node:assert/strict";
import test from "node:test";
import {
  feedbackCommentRequired,
  submitAppFeedback,
  type AppFeedbackStore,
} from "@/lib/app-feedback";
import type { AppFeedback } from "@/types/database";

test("low ratings require a comment", () => {
  assert.equal(feedbackCommentRequired(1), true);
  assert.equal(feedbackCommentRequired(2), true);
  assert.equal(feedbackCommentRequired(3), false);
  assert.equal(feedbackCommentRequired(5), false);
});

test("submitAppFeedback requires stars", async () => {
  const store: AppFeedbackStore = {
    submit: async () => ({ data: null, error: null }),
  };
  const result = await submitAppFeedback(store, {
    overall: 0,
    category: "experience",
    comment: null,
  });
  assert.deepEqual(result, { ok: false, message: "Pick a star rating" });
});

test("submitAppFeedback requires comment when overall <= 2", async () => {
  const store: AppFeedbackStore = {
    submit: async () => ({ data: null, error: null }),
  };
  const result = await submitAppFeedback(store, {
    overall: 2,
    category: "bug",
    comment: "  ",
  });
  assert.deepEqual(result, {
    ok: false,
    message: "Please add a short note for low ratings",
  });
});

test("submitAppFeedback surfaces cooldown errors from RPC", async () => {
  const store: AppFeedbackStore = {
    submit: async () => ({
      data: null,
      error: { message: "You can only send feedback once every 24 hours" },
    }),
  };
  const result = await submitAppFeedback(store, {
    overall: 4,
    category: "feature",
    comment: null,
  });
  assert.deepEqual(result, {
    ok: false,
    message: "You can only send feedback once every 24 hours",
  });
});

test("submitAppFeedback trims comment and returns row", async () => {
  const row: AppFeedback = {
    id: "fb1",
    user_id: "u1",
    overall: 5,
    category: "experience",
    comment: "Great app",
    active_mode: "freelancer",
    created_at: "2026-07-31T00:00:00Z",
  };
  let captured: unknown = null;
  const store: AppFeedbackStore = {
    submit: async (input) => {
      captured = input;
      return { data: row, error: null };
    },
  };
  const result = await submitAppFeedback(store, {
    overall: 5,
    category: "experience",
    comment: " Great app ",
  });
  assert.deepEqual(result, { ok: true, data: row });
  assert.deepEqual(captured, {
    overall: 5,
    category: "experience",
    comment: "Great app",
  });
});
