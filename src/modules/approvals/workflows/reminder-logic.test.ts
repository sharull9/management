import assert from "node:assert/strict";
import { test } from "node:test";
import {
  firstReminderDelay,
  reminderDecision,
  reminderDelayMs,
} from "./reminder-logic";

const pending = {
  status: "PENDING",
  steps: [{ id: "step", status: "PENDING" }],
};
test("reminders target unique eligible users and stop after three", () => {
  for (let sent = 0; sent < 3; sent++) {
    assert.deepEqual(reminderDecision(pending, "step", sent, ["a", "b", "a"]), {
      shouldRemind: true,
      userIds: ["a", "b"],
    });
  }
  assert.deepEqual(reminderDecision(pending, "step", 3, ["a"]), {
    shouldRemind: false,
    userIds: [],
  });
});
test("missing, completed, canceled or advanced requests stop reminders", () => {
  for (const request of [
    null,
    { ...pending, status: "APPROVED" },
    { ...pending, status: "CANCELED" },
    {
      status: "PENDING",
      steps: [
        { id: "step", status: "APPROVED" },
        { id: "next", status: "PENDING" },
      ],
    },
  ]) {
    assert.equal(
      reminderDecision(request, "step", 0, ["a"]).shouldRemind,
      false,
    );
  }
  assert.deepEqual(reminderDecision(pending, "step", 0, []).userIds, []);
});
test("delay accepts fractional hours and falls back for invalid overrides", () => {
  assert.equal(reminderDelayMs("0.001"), 3600);
  assert.equal(reminderDelayMs("0.0000004"), 1);
  assert.equal(reminderDelayMs("0.000001"), 4);
  for (const value of [undefined, "", "0", "-1", "NaN", "Infinity", "1e308"])
    assert.equal(reminderDelayMs(value), 86400000);
});

test("recovered launches keep the submission deadline and old runs keep their relative delay", () => {
  const submitted = "2026-10-31T00:00:00.000Z";
  const now = Date.parse(submitted);
  assert.equal(firstReminderDelay(60000, submitted, now + 10000), 50000);
  assert.equal(firstReminderDelay(60000, submitted, now + 120000), 0);
  assert.equal(firstReminderDelay(60000, undefined, now), 60000);
});
