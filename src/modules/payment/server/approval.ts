import "server-only";
import { writeAudit } from "@/core/audit";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { ApprovalHandler } from "@/modules/approvals/server/handlers";
import { validateRequestBills } from "./request-service";
import { lockSettlement } from "./service";

async function updateStatus(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "DRAFT",
  actorId: string,
): Promise<void> {
  await lockSettlement(tx, request.organizationId);
  const row = await tx.paymentRequest.findFirstOrThrow({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
      status: "PENDING_APPROVAL",
    },
    include: { bills: true, organization: true },
  });
  if (status === "APPROVED") await validateRequestBills(tx, row);
  await tx.paymentRequest.update({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
      status: "PENDING_APPROVAL",
    },
    data: { status },
  });
  await writeAudit(
    {
      tenantId: row.organization.tenantId,
      organizationId: row.organizationId,
      userId: actorId,
      entityType: "PaymentRequest",
      entityId: row.id,
      action: status === "APPROVED" ? "APPROVE" : "RETURN_TO_DRAFT",
    },
    tx,
  );
}

export const onApproved: ApprovalHandler["onApproved"] = (
  request,
  tx,
  actorId,
) => updateStatus(request, tx, "APPROVED", actorId);
export const onRejected: ApprovalHandler["onRejected"] = (
  request,
  tx,
  actorId,
) => updateStatus(request, tx, "DRAFT", actorId);
export const onCanceled: NonNullable<ApprovalHandler["onCanceled"]> = (
  request,
  tx,
  actorId,
) => updateStatus(request, tx, "DRAFT", actorId);

export const paymentRequestApproval: ApprovalHandler = {
  onApproved,
  onRejected,
  onCanceled,
};
