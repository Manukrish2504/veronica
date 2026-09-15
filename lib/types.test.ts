import { test } from "node:test";
import assert from "node:assert/strict";
import { band, needsYou, type AppView, type Draft } from "./types.ts";

test("band boundaries match the reference weights", () => {
  assert.equal(band(75), "Strong");
  assert.equal(band(74), "Good");
  assert.equal(band(60), "Good");
  assert.equal(band(59), "Moderate");
  assert.equal(band(45), "Moderate");
  assert.equal(band(44), "Weak");
  assert.equal(band(30), "Weak");
  assert.equal(band(29), "Poor");
});

test("needsYou flags the human gates and nothing else", () => {
  const base = { id: "a", jobId: "j", notes: "", timeline: [], job: {} as AppView["job"] };
  const ready: Draft = { id: "d", applicationId: "a", kind: "cv", content: "", changes: [], status: "ready", version: 1, updatedAt: "" };
  assert.deepEqual(needsYou({ ...base, status: "review", drafts: [ready] }), ["1 draft to review"]);
  assert.deepEqual(needsYou({ ...base, status: "review", drafts: [{ ...ready, status: "approved" }] }), ["Ready to apply"]);
  assert.deepEqual(needsYou({ ...base, status: "applying", drafts: [], submission: { method: "assisted", url: "", step: "your_turn", updatedAt: "" } }), ["Your turn to submit"]);
  assert.deepEqual(needsYou({ ...base, status: "applied", drafts: [], followUpAt: "2026-09-10" }, "2026-09-14"), ["Follow-up due"]);
  assert.deepEqual(needsYou({ ...base, status: "applied", drafts: [], followUpAt: "2026-09-20" }, "2026-09-14"), []);
  assert.deepEqual(needsYou({ ...base, status: "drafting", drafts: [] }), []);
});
