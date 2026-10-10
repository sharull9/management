import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { registerApprovalHandler } from "@/modules/approvals";
import { auditEffect } from "./approval-audit";
import { approveReceipt } from "./receipt-approval";
import { lockDocument } from "./service";
import { approveTransfer } from "./transfer-approval";
export const documentKinds = {
  requests: {
    documentType: "PURCHASE_REQUEST",
    entity: "PurchaseRequest",
    lock: "PR",
    permission: "purchase.request.create",
  },
  orders: {
    documentType: "PURCHASE_ORDER",
    entity: "PurchaseOrder",
    lock: "PO",
    permission: "purchase.order.create",
  },
  receipts: {
    documentType: "GRN",
    entity: "GoodsReceipt",
    lock: "GRN",
    permission: "grn.create",
  },
  transfers: {
    documentType: "STOCK_TRANSFER",
    entity: "StockTransfer",
    lock: "ST",
    permission: "inventory.transfer",
  },
} as const;
export type DocumentKind = keyof typeof documentKinds;
export async function document(
  tx: Prisma.TransactionClient,
  kind: DocumentKind,
  orgId: string,
  documentId: string,
) {
  const where = { id: documentId, organizationId: orgId };
  switch (kind) {
    case "requests":
      return tx.purchaseRequest.findFirstOrThrow({ where });
    case "orders":
      return tx.purchaseOrder.findFirstOrThrow({ where });
    case "receipts":
      return tx.goodsReceipt.findFirstOrThrow({ where });
    case "transfers":
      return tx.stockTransfer.findFirstOrThrow({ where });
  }
}
export async function updateDocument(
  tx: Prisma.TransactionClient,
  kind: DocumentKind,
  documentId: string,
  data: {
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED";
    approvalRequestId?: string;
  },
) {
  switch (kind) {
    case "requests":
      await tx.purchaseRequest.update({ where: { id: documentId }, data });
      await tx.purchaseRequestLine.updateMany({
        where: { requestId: documentId },
        data: { status: data.status },
      });
      break;
    case "orders":
      await tx.purchaseOrder.update({ where: { id: documentId }, data });
      break;
    case "receipts":
      await tx.goodsReceipt.update({ where: { id: documentId }, data });
      break;
    case "transfers":
      await tx.stockTransfer.update({ where: { id: documentId }, data });
  }
}
async function applyDecision(
  kind: DocumentKind,
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  actorId: string,
  approved: boolean,
) {
  await lockDocument(tx, documentKinds[kind].lock, request.documentId);
  const row = await document(
    tx,
    kind,
    request.organizationId,
    request.documentId,
  );
  if (row.approvalRequestId !== request.id || row.status !== "PENDING_APPROVAL")
    throw new Error("Document no longer matches this pending approval.");
  if (approved && kind === "receipts")
    await approveReceipt(tx, request, actorId);
  if (approved && kind === "transfers")
    await approveTransfer(tx, request, actorId);
  await updateDocument(tx, kind, row.id, {
    status: approved ? "APPROVED" : "DRAFT",
  });
  await auditEffect(
    tx,
    request,
    actorId,
    documentKinds[kind].entity,
    row.id,
    approved ? "APPROVED" : "RETURN_TO_DRAFT",
  );
}
export function registerProcurementHandlers(
  register: typeof registerApprovalHandler,
) {
  for (const kind of Object.keys(documentKinds) as DocumentKind[])
    register(documentKinds[kind].documentType, {
      onApproved: (r, tx, actor) => applyDecision(kind, r, tx, actor, true),
      onRejected: (r, tx, actor) => applyDecision(kind, r, tx, actor, false),
      onCanceled: (r, tx, actor) => applyDecision(kind, r, tx, actor, false),
    });
}
