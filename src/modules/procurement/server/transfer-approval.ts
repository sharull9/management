import { Decimal } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { syncStockMovementJournal } from "@/modules/accounting/server/source-stock";
import { costEntryAmounts } from "@/modules/currency/server/cost-entry";
import { getProjectCostRecognition } from "@/modules/project-cost/server/cost-recognition";
import { materialCostEffects } from "@/modules/project-cost-policy/util";
import { movingAverage } from "@/modules/stock-valuation/util";
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
  await lockAccountingScope(tx, request.organizationId);
  const transfer = await tx.stockTransfer.findUniqueOrThrow({
    where: { id: request.documentId },
    include: { lines: true, project: true, toProject: true },
  });
  if (
    transfer.toProject.organizationId !== request.organizationId ||
    transfer.project.organizationId !== request.organizationId
  )
    throw new UserFacingError(
      "Transfer projects must belong to the same organization.",
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
            ...(await costEntryAmounts(tx, {
              organizationId: request.organizationId,
              projectId: movement.projectId,
              date: transfer.date,
              amount: effect.amount,
            })),
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
