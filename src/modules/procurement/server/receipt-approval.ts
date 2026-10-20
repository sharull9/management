import { Decimal } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { syncStockMovementJournal } from "@/modules/accounting/server/source-stock";
import { costEntryAmounts } from "@/modules/currency/server/cost-entry";
import { organizationBaseCurrency } from "@/modules/currency/server/rates";
import { getProjectCostRecognition } from "@/modules/project-cost/server/cost-recognition";
import { materialCostEffects } from "@/modules/project-cost-policy/util";
import {
  movingAverage,
  receiptValuation,
} from "@/modules/stock-valuation/util";
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
  await lockAccountingScope(tx, request.organizationId);
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
  const base = await organizationBaseCurrency(tx, request.organizationId);
  const sourceMode = await getProjectCostRecognition(tx, receipt.projectId);
  for (const line of receipt.lines) {
    const poLine = await tx.purchaseOrderLine.findFirstOrThrow({
      where: { id: line.poLineId, orderId: po.id },
    });
    if (line.uomId !== poLine.uomId || !line.poLine.variant.item.stockTracked)
      throw new UserFacingError("Invalid stock receipt line.");
    assertReceiptQuantity(
      poLine.qty,
      poLine.receivedQty,
      line.receivedQty,
      po.receiptTolerancePercent,
    );
    const qty = new Decimal(line.acceptedQty).mul(poLine.stockFactor);
    if (!qty.eq(qty.toDecimalPlaces(4)))
      throw new UserFacingError("Stock quantity exceeds four decimal places.");
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
      // Stock is valued in base currency: accepted qty x PO net price x the
      // GRN's rate, converted once and rounded to base decimals.
      const valuation = receiptValuation({
        acceptedQty: line.acceptedQty,
        netRate: poLine.netRate,
        stockQty: qty,
        exchangeRate: receipt.exchangeRate,
        baseDecimals: base.decimals,
      });
      // Validates the balance (no negative stock) before posting.
      movingAverage(balance, { qty, unitCost: valuation.unitCost });
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: request.organizationId,
          projectId: receipt.projectId,
          itemVariantId: poLine.itemVariantId,
          date: receipt.receivedDate,
          type: "GRN_IN",
          qty,
          unitCost: valuation.unitCost,
          totalCost: valuation.baseValue,
          sourceType: "GRN",
          sourceId: line.id,
        },
      });
      await syncStockMovementJournal(
        tx,
        request.organizationId,
        movement.id,
        actorId,
      );
      await auditEffect(
        tx,
        request,
        actorId,
        "StockMovement",
        movement.id,
        "CREATE",
      );
      const recognise = materialCostEffects({
        event: "GRN",
        sourceMode,
        value: valuation.documentValue,
      }).length;
      if (recognise) {
        const cost = await tx.costEntry.create({
          data: {
            organizationId: request.organizationId,
            projectId: receipt.projectId,
            date: receipt.receivedDate,
            costType: "MATERIAL",
            ...(await costEntryAmounts(tx, {
              organizationId: request.organizationId,
              projectId: receipt.projectId,
              date: receipt.receivedDate,
              // Original amount is in the GRN currency; its base amount equals
              // the stock movement value above.
              currency: receipt.currency,
              exchangeRate: receipt.exchangeRate,
              amount: valuation.documentValue.toString(),
            })),
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
