import "server-only";
import { after } from "next/server";
import { start } from "workflow/api";
import { db } from "@/core/db";
import { approvalReminder } from "../workflows/approval-reminder";
import { reminderDelayMs } from "../workflows/reminder-logic";

export async function startApprovalReminder(requestId: string, stepId: string) {
  try {
    const request = await db.approvalRequest.findUnique({
      where: { id: requestId },
      include: { steps: { where: { id: stepId, status: "PENDING" } } },
    });
    // A caller-owned transaction may have rolled back before the response finished.
    const step = request?.steps[0];
    if (request?.status !== "PENDING" || !step) return;
    await start(approvalReminder, [
      requestId,
      step.id,
      reminderDelayMs(process.env.APPROVAL_REMINDER_HOURS),
    ]);
  } catch (error) {
    console.error("Failed to start approval reminders", { requestId, error });
  }
}

export function deferApprovalReminder(requestId: string, stepId: string) {
  try {
    // Only register here. The callback uses the root client after the response/commit.
    after(() => startApprovalReminder(requestId, stepId));
  } catch (error) {
    console.error("Failed to schedule approval reminders", {
      requestId,
      error,
    });
  }
}
