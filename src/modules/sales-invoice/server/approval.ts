import "server-only";
import { writeAudit } from "@/core/audit";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import { syncSalesInvoiceJournal } from "@/modules/accounting/server/source-sales";
import type { ApprovalHandler } from "@/modules/approvals/server/handlers";
import { postInvoiceStock } from "./stock";

async function updateStatus(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "DRAFT",
  actorId: string,
): Promise<void> {
  await tx.salesInvoice.update({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
      status: "PENDING_APPROVAL",
    },
    data: { status },
  });
  const organization = await tx.organization.findUniqueOrThrow({
    where: { id: request.organizationId },
  });
  await writeAudit(
    {
      tenantId: organization.tenantId,
      organizationId: request.organizationId,
      userId: actorId,
      entityType: "SalesInvoice",
      entityId: request.documentId,
      action: status === "APPROVED" ? "APPROVE" : "RETURN_TO_DRAFT",
    },
    tx,
  );
}

export const onApproved: ApprovalHandler["onApproved"] = async (
  request,
  tx,
  actorId,
) => {
  await lockAccountingScope(tx, request.organizationId);
  const invoice = await tx.salesInvoice.findFirstOrThrow({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
      status: "PENDING_APPROVAL",
    },
  });
  await postInvoiceStock(tx, invoice, actorId);
  await updateStatus(request, tx, "APPROVED", actorId);
  await syncSalesInvoiceJournal(
    tx,
    request.organizationId,
    invoice.id,
    actorId,
  );
};
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

export const salesInvoiceApproval: ApprovalHandler = {
  onApproved,
  onRejected,
  onCanceled,
};
