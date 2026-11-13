import "server-only";
import { db } from "@/core/db";
import {
  MAX_APPROVAL_REMINDERS,
  reminderDecision,
} from "../workflows/reminder-logic";
import { listEligibleApprovers } from "./authorization";
import "./register";

export async function createApprovalReminder(
  requestId: string,
  stepId: string,
  sent: number,
) {
  return db.$transaction(async (tx) => {
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
