export const MAX_APPROVAL_REMINDERS = 3;
export const DEFAULT_APPROVAL_REMINDER_HOURS = 24;

export function reminderDelayMs(hours?: string) {
  const milliseconds = Number(hours) * 3_600_000;
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? Math.max(1, Math.round(milliseconds))
    : DEFAULT_APPROVAL_REMINDER_HOURS * 3_600_000;
}

export function reminderDecision(
  request: { status: string; steps: { id: string; status: string }[] } | null,
  stepId: string,
  remindersSent: number,
  eligibleUserIds: string[],
) {
  const shouldRemind =
    remindersSent < MAX_APPROVAL_REMINDERS &&
    request?.status === "PENDING" &&
    request.steps.some(
      (step) => step.id === stepId && step.status === "PENDING",
    );
  return {
    shouldRemind: !!shouldRemind,
    userIds: shouldRemind ? [...new Set(eligibleUserIds)] : [],
  };
}
