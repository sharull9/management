import { sleep } from "workflow";
import { MAX_APPROVAL_REMINDERS } from "./reminder-logic";

export async function approvalReminder(
  requestId: string,
  stepId: string,
  delayMs: number,
) {
  "use workflow";
  for (let sent = 0; sent < MAX_APPROVAL_REMINDERS; sent++) {
    await sleep(delayMs);
    if (!(await createReminder(requestId, stepId, sent))) return;
  }
}

async function createReminder(requestId: string, stepId: string, sent: number) {
  "use step";
  const { db } = await import("@/core/db");
  const { listEligibleApprovers } = await import("../server/authorization");
  const { reminderDecision } = await import("./reminder-logic");
  await import("../server/register");
  return db.$transaction(async (tx) => {
    // Serialize with approve/cancel so an already completed step gets no reminder.
    await tx.$queryRaw`SELECT id FROM approval_requests WHERE id = ${requestId} FOR UPDATE`;
    const request = await tx.approvalRequest.findUnique({
      where: { id: requestId },
      include: { steps: true, organization: { include: { tenant: true } } },
    });
    if (!request || request.organization.tenant.status !== "ACTIVE")
      return false;
    const step = request.steps.find((step) => step.id === stepId);
    if (!step || !reminderDecision(request, stepId, sent, []).shouldRemind)
      return false;
    const users = await listEligibleApprovers(step, request, tx);
    const decision = reminderDecision(request, stepId, sent, users);
    await tx.notification.createMany({
      data: decision.userIds.map((userId) => ({
        // Stable across retries and duplicate launches for this request/step.
        id: `approval-reminder:${requestId}:${stepId}:${sent}:${userId}`,
        tenantId: request.organization.tenantId,
        organizationId: request.organizationId,
        userId,
        kind: "APPROVAL_REMINDER",
        title: `Approval reminder ${sent + 1} of ${MAX_APPROVAL_REMINDERS}`,
        body: `${request.title} is waiting for your ${step.name.toLowerCase()}.`,
        href: `/${request.organization.slug}/approvals`,
      })),
      skipDuplicates: true,
    });
    return true;
  });
}
