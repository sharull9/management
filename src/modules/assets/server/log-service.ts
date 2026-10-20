import { UserFacingError } from "@/core/errors";
import "server-only";
import { assertPermission, type OrgContext } from "@/core/context";
import { Decimal } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import { organizationBaseCurrency } from "@/modules/currency/server/rates";
import { assetFuelLogInput, assetTripInput, assetUsageInput } from "../schema";
import { calculateElectricity, calculateEquipmentCost } from "../util";
import { assertAssetProject } from "./authorization";
import { audit, removeCost, syncCost } from "./log-ledger";
import {
  assertInAllocation,
  assertMeterTimeline,
  lockAsset,
  scopedAsset,
} from "./log-validation";

type Tx = Prisma.TransactionClient;
type LogKind = "TRIP" | "USAGE" | "FUEL";

export async function saveTrip(tx: Tx, ctx: OrgContext, raw: unknown) {
  assertPermission(ctx, "asset.log");
  await lockAccountingScope(tx, ctx.org.id);
  const input = assetTripInput.parse(raw);
  await lockAsset(tx, input.assetId);
  const existing = input.id
    ? await tx.assetTrip.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      })
    : null;
  if (input.id && !existing)
    throw new UserFacingError("Trip was not found in this organization.");
  if (
    existing &&
    (existing.assetId !== input.assetId ||
      existing.projectId !== input.projectId ||
      existing.allocationId !== input.allocationId)
  )
    throw new UserFacingError(
      "An existing log cannot be moved to another asset, project, or allocation.",
    );
  const { asset, allocation } = await scopedAsset(tx, ctx, input, !existing);
  if (asset.meterType !== "KM")
    throw new UserFacingError("Trips require an asset measured in kilometres.");
  const outAt = new Date(input.outAt),
    inAt = new Date(input.inAt);
  assertInAllocation(outAt, allocation.startDate, allocation.endDate);
  assertInAllocation(inAt, allocation.startDate, allocation.endDate);
  await assertMeterTimeline(
    tx,
    asset.id,
    "TRIP",
    existing?.id,
    outAt,
    inAt,
    input.startReading,
    input.endReading,
  );
  const rate = existing?.equipmentRateSnapshot ?? asset.equipmentRatePerMeter;
  const base = await organizationBaseCurrency(tx, ctx.org.id);
  const cost = calculateEquipmentCost(
    new Decimal(input.endReading).sub(input.startReading),
    rate,
    base.decimals,
  );
  const electric = existing
    ? existing.powerRatingKwSnapshot != null
    : asset.powerType === "ELECTRIC";
  const power = existing?.powerRatingKwSnapshot ?? asset.powerRatingKw;
  const tariff = existing?.electricityTariffSnapshot ?? asset.electricityTariff;
  if (electric && (power == null || tariff == null))
    throw new UserFacingError("Electric asset settings are incomplete.");
  const hours = new Decimal(String(inAt.getTime() - outAt.getTime())).div(
    "3600000",
  );
  const electricity = electric
    ? calculateElectricity({
        hours,
        powerRatingKw: power ?? "0",
        tariff: tariff ?? "0",
        decimals: base.decimals,
      })
    : null;
  const data = {
    organizationId: ctx.org.id,
    assetId: asset.id,
    allocationId: allocation.id,
    projectId: input.projectId,
    outAt,
    inAt,
    startReading: new Decimal(input.startReading),
    endReading: new Decimal(input.endReading),
    equipmentRateSnapshot: rate,
    equipmentCost: cost,
    powerRatingKwSnapshot: electric ? power : null,
    electricityTariffSnapshot: electric ? tariff : null,
    electricityKwh: electricity?.kwh ?? null,
    electricityCost: electricity?.cost ?? null,
    notes: input.notes ?? null,
  };
  const row = existing
    ? await tx.assetTrip.update({ where: { id: existing.id }, data })
    : await tx.assetTrip.create({
        data: { ...data, createdById: ctx.user.id },
      });
  await syncCost(tx, ctx, {
    projectId: input.projectId,
    sourceId: row.id,
    sourceType: "ASSET_TRIP",
    costType: "EQUIPMENT",
    date: outAt,
    amount: cost,
    description: `Asset trip: ${asset.name}`,
  });
  if (electricity)
    await syncCost(tx, ctx, {
      projectId: input.projectId,
      sourceId: row.id,
      sourceType: "ASSET_ELECTRICITY",
      costType: "ELECTRICITY",
      date: outAt,
      amount: electricity.cost,
      description: `Asset electricity: ${asset.name}`,
    });
  else await removeCost(tx, ctx, row.id, "ASSET_ELECTRICITY");
  await audit(ctx, tx, "AssetTrip", row.id, existing ? "UPDATE" : "CREATE");
  return row;
}

export async function saveUsage(tx: Tx, ctx: OrgContext, raw: unknown) {
  assertPermission(ctx, "asset.log");
  await lockAccountingScope(tx, ctx.org.id);
  const input = assetUsageInput.parse(raw);
  await lockAsset(tx, input.assetId);
  const existing = input.id
    ? await tx.assetUsage.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      })
    : null;
  if (input.id && !existing)
    throw new UserFacingError("Usage was not found in this organization.");
  if (
    existing &&
    (existing.assetId !== input.assetId ||
      existing.projectId !== input.projectId ||
      existing.allocationId !== input.allocationId)
  )
    throw new UserFacingError(
      "An existing log cannot be moved to another asset, project, or allocation.",
    );
  const { asset, allocation } = await scopedAsset(tx, ctx, input, !existing);
  if (asset.meterType !== "HOURS")
    throw new UserFacingError("Usage logs require an asset measured in hours.");
  const startAt = new Date(input.startAt),
    endAt = new Date(input.endAt);
  assertInAllocation(startAt, allocation.startDate, allocation.endDate);
  assertInAllocation(endAt, allocation.startDate, allocation.endDate);
  await assertMeterTimeline(
    tx,
    asset.id,
    "USAGE",
    existing?.id,
    startAt,
    endAt,
    input.startReading,
    input.endReading,
  );
  const rate = existing?.equipmentRateSnapshot ?? asset.equipmentRatePerMeter;
  const base = await organizationBaseCurrency(tx, ctx.org.id);
  const equipmentCost = calculateEquipmentCost(
    new Decimal(input.endReading).sub(input.startReading),
    rate,
    base.decimals,
  );
  const electric = existing
    ? existing.powerRatingKwSnapshot != null
    : asset.powerType === "ELECTRIC";
  const power = existing ? existing.powerRatingKwSnapshot : asset.powerRatingKw;
  const tariff = existing
    ? existing.electricityTariffSnapshot
    : asset.electricityTariff;
  if (electric && (power == null || tariff == null))
    throw new UserFacingError("Electric asset settings are incomplete.");
  const electricity = electric
    ? calculateElectricity({
        hours: new Decimal(String(endAt.getTime() - startAt.getTime())).div(
          "3600000",
        ),
        powerRatingKw: power ?? "0",
        tariff: tariff ?? "0",
        decimals: base.decimals,
      })
    : null;
  const data = {
    organizationId: ctx.org.id,
    assetId: asset.id,
    allocationId: allocation.id,
    projectId: input.projectId,
    startAt,
    endAt,
    startReading: new Decimal(input.startReading),
    endReading: new Decimal(input.endReading),
    equipmentRateSnapshot: rate,
    equipmentCost,
    powerRatingKwSnapshot: electric ? power : null,
    electricityTariffSnapshot: electric ? tariff : null,
    electricityKwh: electricity?.kwh ?? null,
    electricityCost: electricity?.cost ?? null,
    notes: input.notes ?? null,
  };
  const row = existing
    ? await tx.assetUsage.update({ where: { id: existing.id }, data })
    : await tx.assetUsage.create({
        data: { ...data, createdById: ctx.user.id },
      });
  await syncCost(tx, ctx, {
    projectId: input.projectId,
    sourceId: row.id,
    sourceType: "ASSET_USAGE",
    costType: "EQUIPMENT",
    date: startAt,
    amount: equipmentCost,
    description: `Asset usage: ${asset.name}`,
  });
  if (electricity)
    await syncCost(tx, ctx, {
      projectId: input.projectId,
      sourceId: row.id,
      sourceType: "ASSET_ELECTRICITY",
      costType: "ELECTRICITY",
      date: startAt,
      amount: electricity.cost,
      description: `Asset electricity: ${asset.name}`,
    });
  else await removeCost(tx, ctx, row.id, "ASSET_ELECTRICITY");
  await audit(ctx, tx, "AssetUsage", row.id, existing ? "UPDATE" : "CREATE");
  return row;
}

export async function saveFuelLog(tx: Tx, ctx: OrgContext, raw: unknown) {
  assertPermission(ctx, "asset.log");
  await lockAccountingScope(tx, ctx.org.id);
  const input = assetFuelLogInput.parse(raw);
  await lockAsset(tx, input.assetId);
  const existing = input.id
    ? await tx.assetFuelLog.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      })
    : null;
  if (input.id && !existing)
    throw new UserFacingError("Fuel log was not found in this organization.");
  if (
    existing &&
    (existing.assetId !== input.assetId ||
      existing.projectId !== input.projectId ||
      existing.allocationId !== input.allocationId)
  )
    throw new UserFacingError(
      "An existing log cannot be moved to another asset, project, or allocation.",
    );
  const { asset, allocation } = await scopedAsset(tx, ctx, input, !existing);
  if (asset.meterType !== "KM" && asset.meterType !== "HOURS")
    throw new UserFacingError("Unsupported asset meter type.");
  if (!existing && asset.powerType !== "DIESEL" && asset.powerType !== "PETROL")
    throw new UserFacingError("Fuel logs require a diesel or petrol asset.");
  const date = new Date(`${input.date}T00:00:00.000Z`);
  assertInAllocation(date, allocation.startDate, allocation.endDate);
  const reading = new Decimal(input.meterReading);
  await assertMeterTimeline(
    tx,
    asset.id,
    "FUEL",
    existing?.id,
    date,
    date,
    reading,
    reading,
  );
  const base = await organizationBaseCurrency(tx, ctx.org.id);
  const totalCost = new Decimal(input.totalCost).toDecimalPlaces(
    base.decimals,
    Decimal.ROUND_HALF_UP,
  );
  const data = {
    organizationId: ctx.org.id,
    assetId: asset.id,
    allocationId: allocation.id,
    projectId: input.projectId,
    date,
    quantityLitres: new Decimal(input.quantityLitres),
    totalCost,
    meterReading: reading,
    notes: input.notes ?? null,
  };
  const row = existing
    ? await tx.assetFuelLog.update({ where: { id: existing.id }, data })
    : await tx.assetFuelLog.create({
        data: { ...data, createdById: ctx.user.id },
      });
  await syncCost(tx, ctx, {
    projectId: input.projectId,
    sourceId: row.id,
    sourceType: "ASSET_FUEL",
    costType: "FUEL",
    date,
    amount: totalCost,
    description: `Asset fuel: ${asset.name}`,
  });
  await audit(ctx, tx, "AssetFuelLog", row.id, existing ? "UPDATE" : "CREATE");
  return row;
}

export async function deleteLog(
  tx: Tx,
  ctx: OrgContext,
  input: { kind: LogKind; id: string },
) {
  assertPermission(ctx, "asset.log");
  await lockAccountingScope(tx, ctx.org.id);
  const row =
    input.kind === "TRIP"
      ? await tx.assetTrip.findFirst({
          where: { id: input.id, organizationId: ctx.org.id },
        })
      : input.kind === "USAGE"
        ? await tx.assetUsage.findFirst({
            where: { id: input.id, organizationId: ctx.org.id },
          })
        : await tx.assetFuelLog.findFirst({
            where: { id: input.id, organizationId: ctx.org.id },
          });
  if (!row)
    throw new UserFacingError("Log was not found in this organization.");
  await lockAsset(tx, row.assetId);
  const lockedRow =
    input.kind === "TRIP"
      ? await tx.assetTrip.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.org.id,
            assetId: row.assetId,
          },
        })
      : input.kind === "USAGE"
        ? await tx.assetUsage.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.org.id,
              assetId: row.assetId,
            },
          })
        : await tx.assetFuelLog.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.org.id,
              assetId: row.assetId,
            },
          });
  if (!lockedRow)
    throw new UserFacingError("Log was not found in this organization.");
  await assertAssetProject(tx, ctx, lockedRow.projectId);
  if (input.kind === "TRIP") {
    await tx.assetTrip.delete({ where: { id: lockedRow.id } });
    await removeCost(tx, ctx, lockedRow.id, "ASSET_TRIP");
    await removeCost(tx, ctx, lockedRow.id, "ASSET_ELECTRICITY");
    await audit(ctx, tx, "AssetTrip", lockedRow.id, "DELETE");
  } else if (input.kind === "USAGE") {
    await tx.assetUsage.delete({ where: { id: lockedRow.id } });
    await removeCost(tx, ctx, lockedRow.id, "ASSET_USAGE");
    await removeCost(tx, ctx, lockedRow.id, "ASSET_ELECTRICITY");
    await audit(ctx, tx, "AssetUsage", lockedRow.id, "DELETE");
  } else {
    await tx.assetFuelLog.delete({ where: { id: lockedRow.id } });
    await removeCost(tx, ctx, lockedRow.id, "ASSET_FUEL");
    await audit(ctx, tx, "AssetFuelLog", lockedRow.id, "DELETE");
  }
  return undefined;
}
