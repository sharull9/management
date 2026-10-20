import { Decimal } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type { Prisma } from "@/generated/prisma/client";
import { stockMovementLines } from "../invoice-postings";
import { lockAccountingScope } from "./locking";
import { removeSourceJournal, syncSourceJournal } from "./posting-service";
import { baseCurrencyDecimals } from "./source-tax";

export async function syncStockMovementJournal(
  tx: Prisma.TransactionClient,
  organizationId: string,
  movementId: string,
  actorId: string,
) {
  await lockAccountingScope(tx, organizationId);
  const movement = await tx.stockMovement.findFirst({
    where: { id: movementId, organizationId },
    include: { project: { select: { organizationId: true } } },
  });
  if (!movement)
    return removeSourceJournal(tx, {
      organizationId,
      actorId,
      sourceType: "STOCK_MOVEMENT",
      sourceId: movementId,
      description: "Removed stock movement",
    });
  if (movement.project.organizationId !== organizationId)
    throw new UserFacingError(
      "Stock movement project belongs to another organization.",
    );
  if (movement.type === "ADJUSTMENT")
    throw new UserFacingError("Unsupported stock movement type.");
  const decimals = await baseCurrencyDecimals(tx, organizationId);
  const value = new Decimal(movement.totalCost)
    .abs()
    .toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const lines = stockMovementLines(
    movement.type,
    value,
    movement.projectId,
  ).map((line) => ({
    ...line,
    description: movement.type,
  }));
  return syncSourceJournal(tx, {
    organizationId,
    actorId,
    sourceType: "STOCK_MOVEMENT",
    sourceId: movement.id,
    date: movement.date,
    description: `${movement.type} stock movement`,
    lines,
  });
}
