import { Decimal } from "@/core/decimal";
import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { getProjectCostRecognition } from "@/modules/project-cost";
import { materialCostEffects } from "@/modules/project-cost-policy";
import { movingAverage } from "@/modules/stock-valuation";
import { auditEffect } from "./approval-audit";
import { assertReceiptQuantity } from "./calculations";
import {
  assertStockDate,
  lockStockProjects,
  stockBalance,
} from "./inventory/service";
import { lockDocument } from "./service";
export async function approveReceipt(
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
  const sourceMode = await getProjectCostRecognition(tx, receipt.projectId);
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
      for (const effect of materialCostEffects({
        event: "GRN",
        sourceMode,
        value: posting.totalCost,
      })) {
        const cost = await tx.costEntry.create({
          data: {
            organizationId: request.organizationId,
            projectId: receipt.projectId,
            date: receipt.receivedDate,
            costType: "MATERIAL",
            amount: effect.amount,
            description: `${receipt.code}: accepted materials`,
            sourceType: "GRN",
            sourceId: line.id,
            createdById: actorId,
          },
        });
        await auditEffect(tx, request, actorId, "CostEntry", cost.id, "CREATE");
      }
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
