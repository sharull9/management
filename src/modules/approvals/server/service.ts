import "server-only";
import "./register";
import { writeAudit } from "@/core/audit";
import {
  type OrgContext,
  requireOrgContext,
  requireUser,
} from "@/core/context";
import { db } from "@/core/db";
import type { DocumentType, Prisma } from "@/generated/prisma/client";
import { canActOnStep } from "./authorization";
import { getApprovalHandler } from "./handlers";
import { nextStep, snapshotSteps } from "./logic";
import { resolvePolicy, type Scope } from "./policy";
import { deferApprovalReminder, startApprovalReminder } from "./start-reminder";

export { canActOnStep, registerManagerResolver } from "./authorization";
export { resolvePolicy } from "./policy";
export async function submitForApproval(
  input: {
    orgSlug: string;
    documentType: DocumentType;
    documentId: string;
    title: string;
    amount?: string;
  } & Scope,
  transaction?: Prisma.TransactionClient,
  authorizedContext?: OrgContext,
) {
  const ctx = authorizedContext ?? (await requireOrgContext(input.orgSlug));
  if (ctx.org.slug !== input.orgSlug)
    throw new Error("Invalid approval organization.");
  const execute = async (tx: Prisma.TransactionClient) => {
    if (
      input.projectId &&
      !(await tx.project.findFirst({
        where: { id: input.projectId, organizationId: ctx.org.id },
      }))
    )
      throw new Error("Invalid approval project.");
    if (
      input.stageId &&
      !(await tx.stage.findFirst({
        where: { id: input.stageId, projectId: input.projectId ?? "" },
      }))
    )
      throw new Error("Invalid approval stage.");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.org.id + input.documentType + input.documentId}))::text`;
    const pending = await tx.approvalRequest.findFirst({
      where: {
        organizationId: ctx.org.id,
        documentType: input.documentType,
        documentId: input.documentId,
        status: "PENDING",
      },
    });
    if (pending)
      throw new Error("This document already has a pending approval.");
    const policy = await resolvePolicy(
      ctx.org.id,
      input.documentType,
      input,
      tx,
    );
    const request = await tx.approvalRequest.create({
      include: {
        steps: { where: { status: "PENDING" }, select: { id: true } },
      },
      data: {
        organizationId: ctx.org.id,
        documentType: input.documentType,
        documentId: input.documentId,
        title: input.title,
        amount: input.amount,
        projectId: input.projectId,
        stageId: input.stageId,
        requestedById: ctx.user.id,
        policyId: policy?.id,
        steps: { create: snapshotSteps(policy?.steps ?? [], input.amount) },
      },
    });
    await writeAudit(
      {
        tenantId: ctx.tenant.id,
        organizationId: ctx.org.id,
        userId: ctx.user.id,
        action: "SUBMIT",
        entityType: "ApprovalRequest",
        entityId: request.id,
      },
      tx,
    );
    return request;
  };
  const request = await (transaction
    ? execute(transaction)
    : db.$transaction(execute));
  const step = request.steps[0];
  if (step) {
    if (transaction) deferApprovalReminder(request.id, step.id);
    else await startApprovalReminder(request.id, step.id);
  }
  return request;
}
export async function actOnApproval(
  stepId: string,
  action: "APPROVE" | "REJECT",
  comment?: string,
) {
  await requireUser();
  if (action === "REJECT" && !comment?.trim())
    throw new Error("A rejection comment is required.");
  const step = await db.approvalRequestStep.findUnique({
    where: { id: stepId },
    include: { request: { include: { organization: true } } },
  });
  if (!step) throw new Error("Approval step not found.");
  const ctx = await requireOrgContext(step.request.organization.slug);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM approval_requests WHERE id = ${step.requestId} FOR UPDATE`;
    const request = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: step.requestId },
      include: { steps: true },
    });
    const current = request.steps.find((s) => s.id === stepId);
    if (!current || !(await canActOnStep(ctx, current, request, tx)))
      throw new Error("You cannot act on this approval step.");
    const now = new Date();
    await tx.approvalRequestStep.update({
      where: { id: stepId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        actedById: ctx.user.id,
        actedAt: now,
        comment: comment?.trim() || null,
      },
    });
    const next =
      action === "APPROVE" ? nextStep(request.steps, current.sequence) : null;
    if (next)
      await tx.approvalRequestStep.update({
        where: { id: next.id },
        data: { status: "PENDING" },
      });
    else {
      const status = action === "APPROVE" ? "APPROVED" : "REJECTED";
      const completed = await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status, completedAt: now },
      });
      await tx.approvalRequestStep.updateMany({
        where: { requestId: request.id, status: "WAITING" },
        data: { status: "CANCELED" },
      });
      const handler = getApprovalHandler(request.documentType);
      if (handler)
        await (action === "APPROVE" ? handler.onApproved : handler.onRejected)(
          completed,
          tx,
          ctx.user.id,
        );
    }
    await writeAudit(
      {
        tenantId: ctx.tenant.id,
        organizationId: ctx.org.id,
        userId: ctx.user.id,
        action,
        entityType: "ApprovalRequest",
        entityId: request.id,
        changes: { stepId, comment: comment?.trim() ?? null },
      },
      tx,
    );
  });
}
export async function cancelApproval(requestId: string) {
  const user = await requireUser();
  const request = await db.approvalRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { organization: true },
  });
  const ctx = await requireOrgContext(request.organization.slug);
  if (request.requestedById !== user.id && !ctx.isAdmin)
    throw new Error("Only the requester or administrator may cancel.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM approval_requests WHERE id = ${requestId} FOR UPDATE`;
    const changed = await tx.approvalRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "CANCELED", completedAt: new Date() },
    });
    if (!changed.count) throw new Error("This request is no longer pending.");
    await tx.approvalRequestStep.updateMany({
      where: { requestId, status: { in: ["WAITING", "PENDING"] } },
      data: { status: "CANCELED" },
    });
    await getApprovalHandler(request.documentType)?.onCanceled?.(
      request,
      tx,
      ctx.user.id,
    );
    await writeAudit(
      {
        tenantId: ctx.tenant.id,
        organizationId: ctx.org.id,
        userId: user.id,
        action: "CANCEL",
        entityType: "ApprovalRequest",
        entityId: requestId,
      },
      tx,
    );
  });
}
export async function listPendingForUser(orgSlug: string) {
  const ctx = await requireOrgContext(orgSlug);
  const steps = await db.approvalRequestStep.findMany({
    where: {
      status: "PENDING",
      request: { organizationId: ctx.org.id, status: "PENDING" },
    },
    include: {
      request: { include: { requestedBy: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const eligible = await Promise.all(
    steps.map(async (step) =>
      (await canActOnStep(ctx, step, step.request)) ? step : null,
    ),
  );
  return eligible.filter((step) => step !== null);
}
