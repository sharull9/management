import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import {
  assertPermission,
  type OrgContext,
  projectAccessWhere,
} from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import type { assetAllocationInput, assetInput } from "../schema";
import { assertAssetConfiguration, assertDateRange } from "../util";

type Tx = Prisma.TransactionClient;
type AssetData = z.output<typeof assetInput>;
type AllocationData = z.output<typeof assetAllocationInput>;

export async function saveAsset(tx: Tx, ctx: OrgContext, input: AssetData) {
  assertPermission(ctx, "asset.manage");
  assertAssetConfiguration(input);
  let existing = input.id
    ? await tx.asset.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      })
    : null;
  if (input.id && !existing) throw new UserFacingError("Asset not found.");
  if (existing) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.id}))::text`;
    existing = await tx.asset.findFirst({
      where: { id: existing.id, organizationId: ctx.org.id },
    });
    if (!existing) throw new UserFacingError("Asset not found.");
    const hasHistory = await Promise.all([
      tx.assetTrip.count({
        where: { organizationId: ctx.org.id, assetId: existing.id },
      }),
      tx.assetUsage.count({
        where: { organizationId: ctx.org.id, assetId: existing.id },
      }),
      tx.assetFuelLog.count({
        where: { organizationId: ctx.org.id, assetId: existing.id },
      }),
    ]).then((counts) => counts.some(Boolean));
    if (
      hasHistory &&
      (existing.type !== input.type ||
        existing.meterType !== input.meterType ||
        existing.powerType !== input.powerType)
    )
      throw new UserFacingError(
        "Asset type, meter and power source cannot change after log history exists.",
      );
  }
  const data = {
    type: input.type,
    meterType: input.meterType,
    powerType: input.powerType,
    name: input.name,
    code: input.code,
    active: input.active,
    equipmentRatePerMeter: input.equipmentRatePerMeter,
    powerRatingKw: input.powerType === "ELECTRIC" ? input.powerRatingKw : null,
    electricityTariff:
      input.powerType === "ELECTRIC" ? input.electricityTariff : null,
  };
  const row = existing
    ? await tx.asset.update({ where: { id: existing.id }, data })
    : await tx.asset.create({
        data: { ...data, organizationId: ctx.org.id, createdById: ctx.user.id },
      });
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "Asset",
      entityId: row.id,
      action: existing ? "UPDATE" : "CREATE",
    },
    tx,
  );
  return row;
}

export async function saveAllocation(
  tx: Tx,
  ctx: OrgContext,
  input: AllocationData,
) {
  assertPermission(ctx, "asset.manage");
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDate = input.endDate
    ? new Date(`${input.endDate}T00:00:00.000Z`)
    : null;
  assertDateRange(startDate, endDate);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.assetId}))::text`;
  const asset = await tx.asset.findFirst({
    where: { id: input.assetId, organizationId: ctx.org.id },
  });
  if (!asset) throw new UserFacingError("Asset not found.");
  const project = await tx.project.findFirst({
    where: {
      id: input.projectId,
      organizationId: ctx.org.id,
      ...projectAccessWhere(ctx),
    },
  });
  if (!project)
    throw new UserFacingError("Project not found in this organization.");
  if (
    "project" in ctx &&
    (ctx.project as { id: string }).id !== input.projectId
  )
    throw new UserFacingError("You do not have access to this project.");
  const previous = input.id
    ? await tx.assetAllocation.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      })
    : null;
  if (input.id && !previous) throw new UserFacingError("Allocation not found.");
  if (previous && previous.assetId !== input.assetId)
    throw new UserFacingError(
      "An allocation cannot be moved to another asset.",
    );
  if (previous) {
    const previousProject = await tx.project.findFirst({
      where: {
        id: previous.projectId,
        organizationId: ctx.org.id,
        ...projectAccessWhere(ctx),
      },
      select: { id: true },
    });
    if (
      !previousProject ||
      ("project" in ctx &&
        (ctx.project as { id: string }).id !== previous.projectId)
    )
      throw new UserFacingError("You do not have access to this project.");
  }
  const endExclusive = endDate ? new Date(endDate.getTime() + 86400000) : null;
  const [trips, usages, fuelLogs] = previous
    ? await Promise.all([
        tx.assetTrip.count({
          where: { organizationId: ctx.org.id, allocationId: previous.id },
        }),
        tx.assetUsage.count({
          where: { organizationId: ctx.org.id, allocationId: previous.id },
        }),
        tx.assetFuelLog.count({
          where: { organizationId: ctx.org.id, allocationId: previous.id },
        }),
      ])
    : [0, 0, 0];
  const hasLogs = trips + usages + fuelLogs > 0;
  if (hasLogs && previous && previous.projectId !== input.projectId)
    throw new UserFacingError(
      "An allocation with existing logs cannot be moved to another project.",
    );
  if (
    hasLogs &&
    previous &&
    (previous.startDate.getTime() !== startDate.getTime() ||
      previous.endDate?.getTime() !== endDate?.getTime())
  ) {
    const outside = await Promise.all([
      tx.assetTrip.count({
        where: {
          organizationId: ctx.org.id,
          allocationId: previous.id,
          OR: [
            { outAt: { lt: startDate } },
            ...(endExclusive ? [{ inAt: { gte: endExclusive } }] : []),
          ],
        },
      }),
      tx.assetUsage.count({
        where: {
          organizationId: ctx.org.id,
          allocationId: previous.id,
          OR: [
            { startAt: { lt: startDate } },
            ...(endExclusive ? [{ endAt: { gte: endExclusive } }] : []),
          ],
        },
      }),
      tx.assetFuelLog.count({
        where: {
          organizationId: ctx.org.id,
          allocationId: previous.id,
          OR: [
            { date: { lt: startDate } },
            ...(endExclusive ? [{ date: { gte: endExclusive } }] : []),
          ],
        },
      }),
    ]);
    if (outside.some(Boolean))
      throw new UserFacingError(
        "Allocation dates cannot exclude existing logs.",
      );
  }
  const overlap = await tx.assetAllocation.findFirst({
    where: {
      organizationId: ctx.org.id,
      assetId: input.assetId,
      ...(input.id ? { id: { not: input.id } } : {}),
      AND: [
        ...(endDate ? [{ startDate: { lte: endDate } }] : []),
        { OR: [{ endDate: null }, { endDate: { gte: startDate } }] },
      ],
    },
  });
  if (overlap)
    throw new UserFacingError(
      "Asset allocations cannot overlap, including their boundary dates.",
    );
  const data = { projectId: input.projectId, startDate, endDate };
  const row = previous
    ? await tx.assetAllocation.update({ where: { id: previous.id }, data })
    : await tx.assetAllocation.create({
        data: {
          ...data,
          organizationId: ctx.org.id,
          assetId: asset.id,
          createdById: ctx.user.id,
        },
      });
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "AssetAllocation",
      entityId: row.id,
      action: previous ? "UPDATE" : "CREATE",
    },
    tx,
  );
  return row;
}

export async function deleteAllocation(
  tx: Tx,
  ctx: OrgContext,
  allocationId: string,
) {
  assertPermission(ctx, "asset.manage");
  const allocation = await tx.assetAllocation.findFirst({
    where: { id: allocationId, organizationId: ctx.org.id },
  });
  if (!allocation) throw new UserFacingError("Allocation not found.");
  assertPermission(ctx, "project.view");
  const project = await tx.project.findFirst({
    where: {
      id: allocation.projectId,
      organizationId: ctx.org.id,
      ...projectAccessWhere(ctx),
    },
    select: { id: true },
  });
  if (!project)
    throw new UserFacingError("You do not have access to this project.");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${allocation.assetId}))::text`;
  const lockedAllocation = await tx.assetAllocation.findFirst({
    where: { id: allocationId, organizationId: ctx.org.id },
  });
  if (!lockedAllocation) throw new UserFacingError("Allocation not found.");
  if (
    "project" in ctx &&
    (ctx.project as { id: string }).id !== lockedAllocation.projectId
  )
    throw new UserFacingError("You do not have access to this project.");
  const lockedProject = await tx.project.findFirst({
    where: {
      id: lockedAllocation.projectId,
      organizationId: ctx.org.id,
      ...projectAccessWhere(ctx),
    },
    select: { id: true },
  });
  if (!lockedProject)
    throw new UserFacingError("You do not have access to this project.");
  const [trips, usages, fuelLogs] = await Promise.all([
    tx.assetTrip.count({ where: { organizationId: ctx.org.id, allocationId } }),
    tx.assetUsage.count({
      where: { organizationId: ctx.org.id, allocationId },
    }),
    tx.assetFuelLog.count({
      where: { organizationId: ctx.org.id, allocationId },
    }),
  ]);
  if (trips + usages + fuelLogs)
    throw new UserFacingError(
      "Allocations with existing logs cannot be deleted.",
    );
  await tx.assetAllocation.delete({ where: { id: lockedAllocation.id } });
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "AssetAllocation",
      entityId: lockedAllocation.id,
      action: "DELETE",
    },
    tx,
  );
  return lockedAllocation;
}
