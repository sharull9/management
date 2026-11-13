import { sleep } from "workflow";
import { firstReminderDelay, MAX_APPROVAL_REMINDERS } from "./reminder-logic";

export async function approvalReminder(
  requestId: string,
  stepId: string,
  delayMs: number,
  submittedAt?: string,
) {
  "use workflow";
  for (let sent = 0; sent < MAX_APPROVAL_REMINDERS; sent++) {
    const delay =
      sent === 0
        ? firstReminderDelay(delayMs, submittedAt, Date.now())
        : delayMs;
    if (delay > 0) await sleep(delay);
    if (!(await createReminder(requestId, stepId, sent))) return;
  }
}

async function createReminder(requestId: string, stepId: string, sent: number) {
  "use step";
  const { createApprovalReminder } = await import(
    "../server/reminder-notifications"
  );
  return createApprovalReminder(requestId, stepId, sent);
}
