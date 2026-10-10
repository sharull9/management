import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { ApprovalHandler } from "@/modules/approvals";
import { auditApprovalEffect } from "@/modules/project";

async function submission(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "REJECTED" | "CANCELED",
  actorId: string,
) {
  const { submissionTaskEffect } = await import("@/modules/approvals");
  const row = await tx.taskSubmission.findFirstOrThrow({
    where: {
      id: request.documentId,
      approvalRequestId: request.id,
      task: { project: { organizationId: request.organizationId } },
    },
  });
  await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${row.taskId} FOR UPDATE`;
  await tx.taskSubmission.update({ where: { id: row.id }, data: { status } });
  await tx.task.update({
    where: { id: row.taskId },
    data:
      status === "CANCELED"
        ? { status: "IN_PROGRESS" }
        : submissionTaskEffect(status === "APPROVED", new Date()),
  });
  await auditApprovalEffect(
    request,
    tx,
    "TaskSubmission",
    row.id,
    status,
    actorId,
  );
  await auditApprovalEffect(request, tx, "Task", row.taskId, status, actorId);
}
async function delay(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "REJECTED" | "CANCELED",
  actorId: string,
) {
  const row = await tx.taskDelayRequest.findFirstOrThrow({
    where: {
      id: request.documentId,
      approvalRequestId: request.id,
      task: { project: { organizationId: request.organizationId } },
    },
  });
  await tx.taskDelayRequest.update({ where: { id: row.id }, data: { status } });
  if (status === "APPROVED") {
    await tx.task.update({
      where: { id: row.taskId },
      data: { dueDate: row.proposedDueDate },
    });
    await auditApprovalEffect(request, tx, "Task", row.taskId, status, actorId);
  }
  await auditApprovalEffect(
    request,
    tx,
    "TaskDelayRequest",
    row.id,
    status,
    actorId,
  );
}
export const taskSubmissionApproval: ApprovalHandler = {
  onApproved: (r, tx, actorId) => submission(r, tx, "APPROVED", actorId),
  onRejected: (r, tx, actorId) => submission(r, tx, "REJECTED", actorId),
  onCanceled: (r, tx, actorId) => submission(r, tx, "CANCELED", actorId),
};
export const taskDelayApproval: ApprovalHandler = {
  onApproved: (r, tx, actorId) => delay(r, tx, "APPROVED", actorId),
  onRejected: (r, tx, actorId) => delay(r, tx, "REJECTED", actorId),
  onCanceled: (r, tx, actorId) => delay(r, tx, "CANCELED", actorId),
};
