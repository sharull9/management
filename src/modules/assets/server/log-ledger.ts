import "server-only";
import { writeAudit } from "@/core/audit";
import type { OrgContext } from "@/core/context";
import { Decimal, type Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import {
  removeCostEntryJournal,
  syncCostEntryJournal,
} from "@/modules/accounting/server/source-costs";
import { costEntryAmounts } from "@/modules/currency/server/cost-entry";
import type { ASSET_COST_SOURCE_TYPES } from "../constants";

type Tx = Prisma.TransactionClient;
type AssetSource = (typeof ASSET_COST_SOURCE_TYPES)[number];
export async function syncCost(
  tx: Tx,
  ctx: OrgContext,
  input: {
    projectId: string;
    sourceId: string;
    sourceType:
      | "ASSET_TRIP"
      | "ASSET_USAGE"
      | "ASSET_ELECTRICITY"
      | "ASSET_FUEL";
    costType: "EQUIPMENT" | "ELECTRICITY" | "FUEL";
    date: Date;
    amount: Numeric;
    description: string;
  },
) {
  const base = await tx.organization.findUniqueOrThrow({
    where: { id: ctx.org.id },
    select: { baseCurrencyRef: { select: { code: true, decimals: true } } },
  });
  const rounded = new Decimal(input.amount).toDecimalPlaces(
    base.baseCurrencyRef.decimals,
    Decimal.ROUND_HALF_UP,
  );
  const amounts = await costEntryAmounts(tx, {
    organizationId: ctx.org.id,
    projectId: input.projectId,
    date: input.date,
    currency: base.baseCurrencyRef.code,
    amount: rounded,
  });
  const entry = await tx.costEntry.upsert({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: ctx.org.id,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    create: {
      organizationId: ctx.org.id,
      projectId: input.projectId,
      date: input.date,
      costType: input.costType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdById: ctx.user.id,
      description: input.description,
      ...amounts,
    },
    update: {
      projectId: input.projectId,
      date: input.date,
      costType: input.costType,
      description: input.description,
      ...amounts,
    },
  });
  await syncCostEntryJournal(tx, entry, ctx.user.id);
  await audit(ctx, tx, "CostEntry", entry.id, "UPSERT");
}

export async function removeCost(
  tx: Tx,
  ctx: OrgContext,
  sourceId: string,
  sourceType: AssetSource,
) {
  const entry = await tx.costEntry.findUnique({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: ctx.org.id,
        sourceId,
        sourceType,
      },
    },
  });
  if (entry) {
    await removeCostEntryJournal(tx, ctx.org.id, entry.id, ctx.user.id);
    await tx.costEntry.delete({ where: { id: entry.id } });
    await audit(ctx, tx, "CostEntry", entry.id, "DELETE");
  }
}

export async function audit(
  ctx: OrgContext,
  tx: Tx,
  entity: string,
  id: string,
  action: string,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType: entity,
      entityId: id,
      action,
    },
    tx,
  );
}
