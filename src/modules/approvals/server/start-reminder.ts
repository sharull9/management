import "server-only";
import { after } from "next/server";
import { start } from "workflow/api";
import { db } from "@/core/db";
import { approvalReminder } from "../workflows/approval-reminder";
import { dispatchReminderOutbox, type ReminderLaunch } from "./reminder-outbox";

const launch: ReminderLaunch = (input) =>
  start(approvalReminder, [
    input.requestId,
    input.stepId,
    input.delayMs,
    input.submittedAt,
  ]);

export async function dispatchApprovalReminders() {
  return dispatchReminderOutbox(launch);
}

export async function startApprovalReminder(requestId: string, stepId: string) {
  try {
    const step = await db.approvalRequestStep.findUnique({
      where: { id: stepId },
      select: { requestId: true },
    });
    if (step?.requestId === requestId)
      await dispatchReminderOutbox(launch, stepId);
  } catch (error) {
    console.error("Approval reminder dispatch deferred to recovery", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export function deferApprovalReminder(requestId: string, stepId: string) {
  try {
    // Only register here. The callback uses the root client after the response/commit.
    after(() => startApprovalReminder(requestId, stepId));
  } catch {
    // Non-HTTP callers need no callback: the committed outbox is polled at startup.
  }
}
