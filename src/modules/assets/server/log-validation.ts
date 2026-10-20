import { UserFacingError } from "@/core/errors";
import "server-only";
import type { OrgContext } from "@/core/context";
import { Decimal, type Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { assertAssetProject } from "./authorization";
import { assertMeterOrder, assertNoIntervalOverlap } from "./log-rules";

export { assertInAllocation } from "./log-rules";

type Tx = Prisma.TransactionClient;
type LogKind = "TRIP" | "USAGE" | "FUEL";
type Ref = {
  id?: string;
  assetId: string;
  projectId: string;
  allocationId: string;
};
export async function lockAsset(tx: Tx, assetId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${assetId}))`;
}

export async function scopedAsset(
  tx: Tx,
  ctx: OrgContext,
  input: Ref,
  creating: boolean,
) {
  await assertAssetProject(tx, ctx, input.projectId);
  const asset = await tx.asset.findFirst({
    where: { id: input.assetId, organizationId: ctx.org.id },
  });
  if (!asset)
    throw new UserFacingError("Asset was not found in this organization.");
  if (creating && !asset.active)
    throw new UserFacingError("Inactive assets cannot receive new logs.");
  const allocation = await tx.assetAllocation.findFirst({
    where: {
      id: input.allocationId,
      assetId: asset.id,
      projectId: input.projectId,
      organizationId: ctx.org.id,
    },
  });
  if (!allocation)
    throw new UserFacingError(
      "Allocation does not match this asset and project.",
    );
  return { asset, allocation };
}

export async function assertMeterTimeline(
  tx: Tx,
  assetId: string,
  kind: LogKind,
  id: string | undefined,
  startAt: Date,
  endAt: Date,
  start: Numeric,
  end: Numeric,
) {
  const [trips, usages, fuels] = await Promise.all([
    tx.assetTrip.findMany({
      where: { assetId, ...(id && kind === "TRIP" ? { id: { not: id } } : {}) },
      select: {
        id: true,
        outAt: true,
        inAt: true,
        startReading: true,
        endReading: true,
      },
    }),
    tx.assetUsage.findMany({
      where: {
        assetId,
        ...(id && kind === "USAGE" ? { id: { not: id } } : {}),
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        startReading: true,
        endReading: true,
      },
    }),
    tx.assetFuelLog.findMany({
      where: { assetId, ...(id && kind === "FUEL" ? { id: { not: id } } : {}) },
      select: { id: true, date: true, meterReading: true },
    }),
  ]);
  const current = [
    { at: startAt, value: new Decimal(start), id: "current:start" },
    { at: endAt, value: new Decimal(end), id: "current:end" },
  ];
  const intervals = [
    ...trips.map((r) => ({
      id: r.id,
      start: r.outAt,
      end: r.inAt,
      startReading: r.startReading,
      endReading: r.endReading,
    })),
    ...usages.map((r) => ({
      id: r.id,
      start: r.startAt,
      end: r.endAt,
      startReading: r.startReading,
      endReading: r.endReading,
    })),
  ];
  if (kind !== "FUEL") assertNoIntervalOverlap(startAt, endAt, intervals);
  const points = [
    ...trips.flatMap((r) => [
      { at: r.outAt, value: new Decimal(r.startReading), id: `${r.id}:start` },
      { at: r.inAt, value: new Decimal(r.endReading), id: `${r.id}:end` },
    ]),
    ...usages.flatMap((r) => [
      {
        at: r.startAt,
        value: new Decimal(r.startReading),
        id: `${r.id}:start`,
      },
      { at: r.endAt, value: new Decimal(r.endReading), id: `${r.id}:end` },
    ]),
    ...fuels.map((r) => ({
      at: r.date,
      value: new Decimal(r.meterReading),
      id: r.id,
      dayGranularity: true,
    })),
    ...current.map((point) => ({ ...point, dayGranularity: kind === "FUEL" })),
  ];
  assertMeterOrder(points);
}
