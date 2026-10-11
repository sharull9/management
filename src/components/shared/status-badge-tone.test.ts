import assert from "node:assert/strict";
import { test } from "node:test";
import { statusLabel, statusTone } from "./status-badge-tone";

test("status tones accept enum values and labels", () => {
  assert.equal(statusTone("PENDING_APPROVAL"), "amber");
  assert.equal(statusTone("pending approval"), "amber");
  assert.equal(statusTone("PAID"), "green");
  assert.equal(statusTone("SOMETHING_ELSE"), "neutral");
});

test("status labels are sentence case", () => {
  assert.equal(statusLabel("PARTIALLY_RECEIVED"), "Partially received");
});
