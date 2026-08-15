import assert from "node:assert/strict";
import test from "node:test";
import {
  ensurePostJobDraftId,
  getPostJobDraftId,
} from "./post-job-draft";

const UUID = "0198af31-2541-7d2d-8ea9-0f32125c4f2a";

test("preserves an existing draft UUID across retries", () => {
  const draft = { id: UUID, title: "Event crew" };

  assert.strictEqual(
    ensurePostJobDraftId(draft, () => {
      throw new Error("should not generate a replacement");
    }),
    draft,
  );
});

test("upgrades a legacy draft with a stable generated UUID", () => {
  const draft = ensurePostJobDraftId({ title: "Event crew" }, () => UUID);

  assert.equal(draft.id, UUID);
  assert.equal(ensurePostJobDraftId(draft).id, UUID);
});

test("replaces malformed draft IDs", () => {
  assert.equal(
    ensurePostJobDraftId({ id: "not-a-uuid", title: "Event crew" }, () => UUID)
      .id,
    UUID,
  );
});

test("reads IDs only from valid persisted draft objects", () => {
  assert.equal(getPostJobDraftId({ id: UUID }), UUID);
  assert.equal(getPostJobDraftId({ id: "not-a-uuid" }), null);
  assert.equal(getPostJobDraftId("legacy-value"), null);
  assert.equal(getPostJobDraftId(null), null);
});
