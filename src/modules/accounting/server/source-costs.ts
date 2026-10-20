import { UserFacingError } from "@/core/errors";
import "server-only";
import { Decimal } from "@/core/decimal";
import type { CostEntry, Prisma } from "@/generated/prisma/client";
import { lockAccountingScope } from "./locking";
import { syncSourceJournal } from "./posting-service";

type Tx = Prisma.TransactionClient;
const allowed = new Set([
  "ATTENDANCE",
  "EXPENSE",
  "ASSET_TRIP",
  "ASSET_USAGE",
  "ASSET_ELECTRICITY",
  "ASSET_FUEL",
]);
function accounts(sourceType: string, costType: string) {
  if (sourceType === "ATTENDANCE")
    return ["LABOUR_EXPENSE", "PAYROLL_PAYABLE"] as const;
  if (sourceType === "EXPENSE") {
    const expense = (
      {
        LABOUR: "LABOUR_EXPENSE",
        MATERIAL: "MATERIAL_EXPENSE",
        EQUIPMENT: "EQUIPMENT_EXPENSE",
        FUEL: "FUEL_EXPENSE",
        ELECTRICITY: "ELECTRICITY_EXPENSE",
        SUBCONTRACT: "SUBCONTRACT_EXPENSE",
        OVERHEAD: "OVERHEAD_EXPENSE",
        OTHER: "OTHER_EXPENSE",
      } as const
    )[costType as "LABOUR"];
    if (!expense)
      throw new UserFacingError(
        `Unsupported approved expense cost type: ${costType}`,
      );
    return [expense, "EXPENSE_PAYABLE"] as const;
  }
  if (sourceType === "ASSET_TRIP" || sourceType === "ASSET_USAGE")
    return ["EQUIPMENT_EXPENSE", "COST_CLEARING"] as const;
  if (sourceType === "ASSET_FUEL")
    return ["FUEL_EXPENSE", "COST_CLEARING"] as const;
  return ["ELECTRICITY_EXPENSE", "COST_CLEARING"] as const;
}

export async function syncCostEntryJournal(
  tx: Tx,
  entry: CostEntry,
  actorId: string,
) {
  if (!allowed.has(entry.sourceType)) return null;
  await lockAccountingScope(tx, entry.organizationId);
  const scoped = await tx.costEntry.findFirst({
    where: { id: entry.id, organizationId: entry.organizationId },
    include: { project: { select: { organizationId: true } } },
  });
  if (!scoped)
    return syncSourceJournal(tx, {
      organizationId: entry.organizationId,
      actorId,
      sourceType: "COST_ENTRY",
      sourceId: entry.id,
      date: entry.date,
      description: "Removed cost entry",
      lines: [],
    });
  if (scoped.project.organizationId !== entry.organizationId)
    throw new UserFacingError("Cost entry is outside this organization.");
  const [expense, payable] = accounts(scoped.sourceType, scoped.costType);
  return syncSourceJournal(tx, {
    organizationId: scoped.organizationId,
    actorId,
    sourceType: "COST_ENTRY",
    sourceId: scoped.id,
    date: scoped.date,
    description: scoped.description,
    lines: new Decimal(scoped.baseAmount).isZero()
      ? []
      : [
          {
            accountKey: expense,
            debit: scoped.baseAmount,
            credit: "0",
            projectId: scoped.projectId,
          },
          {
            accountKey: payable,
            debit: "0",
            credit: scoped.baseAmount,
            projectId: scoped.projectId,
          },
        ],
  });
}

export async function removeCostEntryJournal(
  tx: Tx,
  organizationId: string,
  costEntryId: string,
  actorId: string,
) {
  await lockAccountingScope(tx, organizationId);
  const entry = await tx.costEntry.findFirst({
    where: { id: costEntryId, organizationId },
  });
  if (!entry)
    return syncSourceJournal(tx, {
      organizationId,
      actorId,
      sourceType: "COST_ENTRY",
      sourceId: costEntryId,
      date: new Date(),
      description: "Removed cost entry",
      lines: [],
    });
  if (!allowed.has(entry.sourceType)) return null;
  return syncSourceJournal(tx, {
    organizationId,
    actorId,
    sourceType: "COST_ENTRY",
    sourceId: entry.id,
    date: entry.date,
    description: entry.description,
    lines: [],
  });
}
