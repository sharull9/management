import { UserFacingError } from "@/core/errors";
import "server-only";
import {
  assertPermission,
  type OrgContext,
  projectAccessWhere,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { type ListParams, listParams, pageInfo } from "@/core/pagination";
import type { Prisma } from "@/generated/prisma/client";
import type { AssetType } from "../type";
import { fuelEfficiencyEstimate } from "./fuel-efficiency";
import {
  assetListWhere,
  assetOrderBy,
  assetSortKeys,
  historySearchWhere,
  historySortKeys,
} from "./list-query-helpers";

function moduleProjectWhere(ctx: OrgContext, permission: string) {
  const scoped =
    "project" in ctx
      ? (ctx as OrgContext & { project: { id: string } }).project
      : null;
  const global = ctx.isAdmin || ctx.permissions.has(permission);
  return {
    organizationId: ctx.org.id,
    ...(scoped ? { id: scoped.id } : {}),
    AND: [
      projectAccessWhere(ctx),
      ...(global
        ? []
        : [
            {
              OR: [
                { managerUserId: ctx.user.id },
                { members: { some: { userId: ctx.user.id, isManager: true } } },
                {
                  members: {
                    some: {
                      userId: ctx.user.id,
                      role: {
                        tenantId: ctx.tenant.id,
                        permissions: { has: permission },
                      },
                    },
                  },
                },
              ],
            },
          ]),
    ],
  };
}

async function queryContext(org: string, projectId?: string) {
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  if (projectId) assertPermission(ctx, "asset.view");
  else if (
    !ctx.isAdmin &&
    !ctx.permissions.has("asset.view") &&
    !ctx.permissions.has("asset.manage") &&
    !ctx.permissions.has("asset.log")
  )
    throw new UserFacingError("You do not have permission to view assets.");
  return ctx;
}

async function projectCapabilities(ctx: OrgContext) {
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, "asset.view"),
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return { projects, ids: projects.map((project) => project.id) };
}

export async function listAssets(
  org: string,
  projectId?: string,
  params: ListParams = {},
) {
  const ctx = await queryContext(org, projectId);
  const { projects, ids } = await projectCapabilities(ctx);
  const input = listParams(params);
  const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
  const statusParam = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const type: AssetType | undefined =
    typeParam === "VEHICLE" || typeParam === "MACHINE" ? typeParam : undefined;
  const active =
    statusParam === "ACTIVE"
      ? true
      : statusParam === "INACTIVE"
        ? false
        : undefined;
  const where: Prisma.AssetWhereInput = assetListWhere(
    ctx.org.id,
    projectId,
    type,
    active,
    input.search,
  );
  const orderBy = assetOrderBy(
    assetSortKeys.includes(input.sort) ? input.sort : "",
    input.direction,
  );
  const [total, canManage, canLog] = await Promise.all([
    db.asset.count({ where }),
    Promise.resolve(ctx.isAdmin || ctx.permissions.has("asset.manage")),
    Promise.resolve(ctx.isAdmin || ctx.permissions.has("asset.log")),
  ]);
  const page = { ...pageInfo(total, input), sortKeys: assetSortKeys };
  const assets = await db.asset.findMany({
    where,
    include: {
      allocations: {
        where: { projectId: { in: ids } },
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: [...orderBy, { id: input.direction }],
    skip: (page.page - 1) * input.pageSize,
    take: input.take,
  });
  return { ctx, assets, projects, canManage, canLog, page };
}

export async function assetDetail(
  org: string,
  assetId: string,
  projectId?: string,
  params: ListParams = {},
) {
  const ctx = await queryContext(org, projectId);
  const { projects, ids } = await projectCapabilities(ctx);
  const asset = await db.asset.findFirstOrThrow({
    where: {
      id: assetId,
      organizationId: ctx.org.id,
      ...(projectId ? { allocations: { some: { projectId } } } : {}),
    },
    include: {
      allocations: {
        where: { projectId: { in: ids } },
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  const input = listParams(params);
  const logWhere = {
    organizationId: ctx.org.id,
    assetId,
    projectId: { in: ids },
    ...(projectId ? { projectId } : {}),
    ...historySearchWhere(input.search),
  };
  const [tripCount, usageCount, fuelCount] = await Promise.all([
    db.assetTrip.count({ where: logWhere }),
    db.assetUsage.count({ where: logWhere }),
    db.assetFuelLog.count({ where: logWhere }),
  ]);
  const tripPage = { ...pageInfo(tripCount, input), sortKeys: historySortKeys };
  const usagePage = {
    ...pageInfo(usageCount, input),
    sortKeys: historySortKeys,
  };
  const fuelPage = { ...pageInfo(fuelCount, input), sortKeys: historySortKeys };
  const [trips, usages, fuelLogs] = await Promise.all([
    db.assetTrip.findMany({
      where: logWhere,
      include: { project: { select: { id: true, name: true, code: true } } },
      orderBy: [{ outAt: input.direction }, { id: input.direction }],
      skip: (tripPage.page - 1) * input.pageSize,
      take: input.take,
    }),
    db.assetUsage.findMany({
      where: logWhere,
      include: { project: { select: { id: true, name: true, code: true } } },
      orderBy: [{ startAt: input.direction }, { id: input.direction }],
      skip: (usagePage.page - 1) * input.pageSize,
      take: input.take,
    }),
    db.assetFuelLog.findMany({
      where: logWhere,
      include: { project: { select: { id: true, name: true, code: true } } },
      orderBy: [
        { date: input.direction },
        { meterReading: input.direction },
        { id: input.direction },
      ],
      skip: (fuelPage.page - 1) * input.pageSize,
      take: input.take,
    }),
  ]);
  // The predecessor contributes only its meter reading; hidden project data never leaves this query.
  const fuelLogsWithEstimate = await Promise.all(
    fuelLogs.map(async (log) => {
      const predecessor = await db.assetFuelLog.findFirst({
        where: {
          organizationId: ctx.org.id,
          assetId,
          OR: [
            { date: { lt: log.date } },
            { date: log.date, meterReading: { lt: log.meterReading } },
            {
              date: log.date,
              meterReading: log.meterReading,
              id: { lt: log.id },
            },
          ],
        },
        select: { meterReading: true },
        orderBy: [{ date: "desc" }, { meterReading: "desc" }, { id: "desc" }],
      });
      return {
        ...log,
        efficiencyEstimate: fuelEfficiencyEstimate(
          asset.meterType,
          predecessor?.meterReading.toString() ?? null,
          log,
        ),
      };
    }),
  );
  return {
    ctx,
    asset: { ...asset, trips, usages, fuelLogs: fuelLogsWithEstimate },
    projects,
    canManage: ctx.isAdmin || ctx.permissions.has("asset.manage"),
    canLog: ctx.isAdmin || ctx.permissions.has("asset.log"),
    historyPages: { trips: tripPage, usages: usagePage, fuel: fuelPage },
  };
}
