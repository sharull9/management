import "server-only";
import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, type OrgContext } from "@/core/context";
import { Decimal } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type { Prisma } from "@/generated/prisma/client";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import { syncStockMovementJournal } from "@/modules/accounting/server/source-stock";
import { movingAverage } from "@/modules/stock-valuation/util";
import type { adjustmentInput } from "../../adjustment-schema";
import { projectScope } from "../service";
import { assertStockDate, lockStockProjects, stockBalance } from "./service";

export async function recordStockAdjustment(
  tx: Prisma.TransactionClient,
  ctx: OrgContext & { project: { id: string } },
  input: z.output<typeof adjustmentInput>,
) {
  assertPermission(ctx, "inventory.adjust");
  if (ctx.project.id !== input.projectId)
    throw new UserFacingError(
      "Stock adjustment is outside the authorized project.",
    );
  await lockAccountingScope(tx, ctx.org.id);
  await projectScope(tx, ctx, input.projectId);
  await lockStockProjects(tx, ctx.org.id, [input.projectId]);
  const variant = await tx.itemVariant.findFirst({
    where: {
      id: input.itemVariantId,
      item: { tenantId: ctx.tenant.id, stockTracked: true },
    },
  });
  if (!variant)
    throw new UserFacingError(
      "Choose a stock-tracked item variant from this tenant.",
    );
  await assertStockDate(
    tx,
    ctx.org.id,
    input.projectId,
    variant.id,
    input.date,
  );
  const balance = await stockBalance(
    tx,
    ctx.org.id,
    input.projectId,
    variant.id,
  );
  const qty = new Decimal(input.qty).mul(
    input.direction === "DECREASE" ? -1 : 1,
  );
  const posting = movingAverage(balance, {
    qty,
    unitCost: input.unitCost || "0",
  });
  const movementId = crypto.randomUUID();
  const movement = await tx.stockMovement.create({
    data: {
      id: movementId,
      organizationId: ctx.org.id,
      projectId: input.projectId,
      itemVariantId: variant.id,
      date: input.date,
      type: "ADJUSTMENT",
      qty,
      unitCost: posting.unitCost,
      totalCost: posting.totalCost,
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: movementId,
      reason: input.reason,
      recordedById: ctx.user.id,
    },
  });
  await syncStockMovementJournal(tx, ctx.org.id, movement.id, ctx.user.id);
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "StockMovement",
      entityId: movement.id,
      action: "CREATE",
      changes: {
        type: "ADJUSTMENT",
        reason: input.reason,
        qty: qty.toString(),
        totalCost: posting.totalCost.toString(),
      },
    },
    tx,
  );
  return movement;
}
