import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { writeAudit } from "../audit";
import { registerManagerResolver } from "./authorization";
import { registerApprovalHandler } from "./handlers";
import { managerApprovers, submissionTaskEffect } from "./project-effects";

async function audit(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
  actorId: string,
) {
  await writeAudit(
    {
      organizationId: request.organizationId,
      userId: actorId,
      action,
      entityType,
      entityId,
      changes: { approvalRequestId: request.id },
    },
    tx,
  );
}
async function submission(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "REJECTED" | "CANCELED",
  actorId: string,
) {
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
  await audit(request, tx, "TaskSubmission", row.id, status, actorId);
  await audit(request, tx, "Task", row.taskId, status, actorId);
}
registerApprovalHandler("TASK_SUBMISSION", {
  onApproved: (r, tx, actorId) => submission(r, tx, "APPROVED", actorId),
  onRejected: (r, tx, actorId) => submission(r, tx, "REJECTED", actorId),
  onCanceled: (r, tx, actorId) => submission(r, tx, "CANCELED", actorId),
});
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
    await audit(request, tx, "Task", row.taskId, status, actorId);
  }
  await audit(request, tx, "TaskDelayRequest", row.id, status, actorId);
}
registerApprovalHandler("TASK_DELAY", {
  onApproved: (r, tx, actorId) => delay(r, tx, "APPROVED", actorId),
  onRejected: (r, tx, actorId) => delay(r, tx, "REJECTED", actorId),
  onCanceled: (r, tx, actorId) => delay(r, tx, "CANCELED", actorId),
});
async function expense(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "REJECTED" | "CANCELED",
  actorId: string,
) {
  const row = await tx.expense.findFirstOrThrow({
    where: {
      id: request.documentId,
      approvalRequestId: request.id,
      project: { organizationId: request.organizationId },
    },
  });
  await tx.expense.update({ where: { id: row.id }, data: { status } });
  if (status === "APPROVED") {
    const entry = await tx.costEntry.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: request.organizationId,
          sourceType: "EXPENSE",
          sourceId: row.id,
        },
      },
      create: {
        organizationId: request.organizationId,
        projectId: row.projectId,
        stageId: row.stageId,
        taskId: row.taskId,
        date: row.date,
        costType: row.costType,
        amount: row.amount,
        description: row.description,
        sourceType: "EXPENSE",
        sourceId: row.id,
        createdById: row.createdById,
      },
      update: {},
    });
    await audit(request, tx, "CostEntry", entry.id, "CREATE", actorId);
  }
  await audit(request, tx, "Expense", row.id, status, actorId);
}
registerApprovalHandler("EXPENSE", {
  onApproved: (r, tx, actorId) => expense(r, tx, "APPROVED", actorId),
  onRejected: (r, tx, actorId) => expense(r, tx, "REJECTED", actorId),
  onCanceled: (r, tx, actorId) => expense(r, tx, "CANCELED", actorId),
});
registerManagerResolver(async (request, type, tx) => {
  if (!request.projectId) return null;
  const project = await tx.project.findFirst({
    where: { id: request.projectId, organizationId: request.organizationId },
    include: { members: { where: { isManager: true } } },
  });
  if (!project) return null;
  if (type === "STAGE_MANAGER") {
    if (!request.stageId) return null;
    const stage = await tx.stage.findFirst({
      where: { id: request.stageId, projectId: project.id },
    });
    return managerApprovers(
      "STAGE_MANAGER",
      project.managerUserId,
      [],
      stage?.managerUserId,
    );
  }
  return managerApprovers(
    "PROJECT_MANAGER",
    project.managerUserId,
    project.members.map((m) => m.userId),
  );
});
