import { Decimal } from "@/core/decimal";
import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { getProjectCostRecognition } from "@/modules/project-cost";
import { materialCostEffects } from "@/modules/project-cost-policy";
import { movingAverage } from "@/modules/stock-valuation";
import { auditEffect } from "./approval-audit";
import {
  assertStockDate,
  lockStockProjects,
  stockBalance,
} from "./inventory/service";
export async function approveTransfer(
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
  const sourceMode = await getProjectCostRecognition(tx, transfer.projectId);
  const destMode = await getProjectCostRecognition(tx, transfer.toProjectId);
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
      const side = incoming ? "destination" : "source";
      const effect = materialCostEffects({
        event: "TRANSFER",
        sourceMode,
        destMode,
        value: posting.totalCost.neg(),
      }).find((effect) => effect.projectSide === side);
      if (effect) {
        const cost = await tx.costEntry.create({
          data: {
            organizationId: request.organizationId,
            projectId: movement.projectId,
            date: transfer.date,
            costType: "MATERIAL",
            amount: effect.amount,
            description: `${transfer.code}: ${incoming ? "received" : "transferred"} materials`,
            sourceType: "TRANSFER",
            sourceId: movement.id,
            createdById: actorId,
          },
        });
        await auditEffect(tx, request, actorId, "CostEntry", cost.id, "CREATE");
      }
    }
  }
}
