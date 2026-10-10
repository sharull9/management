import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { registerApprovalHandler } from "../approvals/handlers";
import { writeAudit } from "../audit";
import {
  assertStockDate,
  lockStockProjects,
  stockBalance,
} from "../inventory/service";
import { assertReceiptQuantity, Decimal, movingAverage } from "./calculations";
import { lockDocument } from "./service";

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
async function auditEffect(
  tx: Prisma.TransactionClient,
  request: ApprovalRequest,
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      organizationId: request.organizationId,
      userId: actorId,
      entityType,
      entityId,
      action,
      changes: { approvalRequestId: request.id },
    },
    tx,
  );
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
async function approveReceipt(
  tx: Prisma.TransactionClient,
  request: ApprovalRequest,
  actorId: string,
) {
  const receipt = await tx.goodsReceipt.findUniqueOrThrow({
    where: { id: request.documentId },
    include: {
      lines: {
        include: {
          poLine: { include: { variant: { include: { item: true } } } },
        },
      },
    },
  });
  await lockDocument(tx, "PO", receipt.poId);
  const po = await tx.purchaseOrder.findFirstOrThrow({
    where: {
      id: receipt.poId,
      organizationId: request.organizationId,
      projectId: receipt.projectId,
      status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
    },
  });
  await lockStockProjects(tx, request.organizationId, [receipt.projectId]);
  for (const line of receipt.lines) {
    const poLine = await tx.purchaseOrderLine.findFirstOrThrow({
      where: { id: line.poLineId, orderId: po.id },
    });
    if (line.uomId !== poLine.uomId || !line.poLine.variant.item.stockTracked)
      throw new Error("Invalid stock receipt line.");
    assertReceiptQuantity(
      poLine.qty,
      poLine.receivedQty,
      line.receivedQty,
      po.receiptTolerancePercent,
    );
    const qty = new Decimal(line.acceptedQty).mul(poLine.stockFactor);
    if (!qty.eq(qty.toDecimalPlaces(4)))
      throw new Error("Stock quantity exceeds four decimal places.");
    if (qty.gt(0)) {
      await assertStockDate(
        tx,
        request.organizationId,
        receipt.projectId,
        poLine.itemVariantId,
        receipt.receivedDate,
      );
      const balance = await stockBalance(
        tx,
        request.organizationId,
        receipt.projectId,
        poLine.itemVariantId,
      );
      const posting = movingAverage(balance, {
        qty,
        unitCost: new Decimal(poLine.netRate).div(poLine.stockFactor),
      });
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: request.organizationId,
          projectId: receipt.projectId,
          itemVariantId: poLine.itemVariantId,
          date: receipt.receivedDate,
          type: "GRN_IN",
          qty,
          unitCost: posting.unitCost,
          totalCost: posting.totalCost,
          sourceType: "GRN",
          sourceId: line.id,
        },
      });
      await auditEffect(
        tx,
        request,
        actorId,
        "StockMovement",
        movement.id,
        "CREATE",
      );
    }
    await tx.purchaseOrderLine.update({
      where: { id: poLine.id },
      data: {
        receivedQty: { increment: line.receivedQty },
        acceptedQty: { increment: line.acceptedQty },
      },
    });
  }
  const lines = await tx.purchaseOrderLine.findMany({
    where: { orderId: po.id },
    include: { variant: { include: { item: true } } },
  });
  const stockLines = lines.filter((l) => l.variant.item.stockTracked);
  await tx.purchaseOrder.update({
    where: { id: po.id },
    data: {
      status: stockLines.every((l) => l.receivedQty.gte(l.qty))
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED",
    },
  });
  await auditEffect(tx, request, actorId, "PurchaseOrder", po.id, "RECEIVE");
}
async function approveTransfer(
  tx: Prisma.TransactionClient,
  request: ApprovalRequest,
  actorId: string,
) {
  const transfer = await tx.stockTransfer.findUniqueOrThrow({
    where: { id: request.documentId },
    include: { lines: true, project: true, toProject: true },
  });
  if (
    transfer.toProject.organizationId !== request.organizationId ||
    transfer.project.organizationId !== request.organizationId ||
    transfer.project.currency !== transfer.toProject.currency
  )
    throw new Error(
      "Transfer projects must belong to the same organization and currency.",
    );
  await lockStockProjects(tx, request.organizationId, [
    transfer.projectId,
    transfer.toProjectId,
  ]);
  for (const line of transfer.lines) {
    for (const projectId of [transfer.projectId, transfer.toProjectId])
      await assertStockDate(
        tx,
        request.organizationId,
        projectId,
        line.itemVariantId,
        transfer.date,
      );
    const balance = await stockBalance(
      tx,
      request.organizationId,
      transfer.projectId,
      line.itemVariantId,
    );
    const posting = movingAverage(balance, {
      qty: new Decimal(line.stockQty).neg(),
    });
    for (const incoming of [false, true]) {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: request.organizationId,
          projectId: incoming ? transfer.toProjectId : transfer.projectId,
          itemVariantId: line.itemVariantId,
          date: transfer.date,
          type: incoming ? "TRANSFER_IN" : "TRANSFER_OUT",
          qty: incoming ? line.stockQty : new Decimal(line.stockQty).neg(),
          unitCost: posting.unitCost,
          totalCost: incoming ? posting.totalCost.neg() : posting.totalCost,
          sourceType: "TRANSFER",
          sourceId: line.id,
        },
      });
      await auditEffect(
        tx,
        request,
        actorId,
        "StockMovement",
        movement.id,
        "CREATE",
      );
    }
  }
}
export function registerProcurementHandlers() {
  for (const kind of Object.keys(documentKinds) as DocumentKind[])
    registerApprovalHandler(documentKinds[kind].documentType, {
      onApproved: (r, tx, actor) => applyDecision(kind, r, tx, actor, true),
      onRejected: (r, tx, actor) => applyDecision(kind, r, tx, actor, false),
      onCanceled: (r, tx, actor) => applyDecision(kind, r, tx, actor, false),
    });
}
