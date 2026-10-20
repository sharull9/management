import { Decimal } from "@/core/decimal";
import "server-only";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { type ListParams, listParams, pageInfo } from "@/core/pagination";
import type { DocumentKind } from "./approval";
import {
  procurementOrderBy,
  procurementSearchWhere,
  procurementSortKeys,
} from "./list-query-helpers";
import { moduleProjectWhere, procurementData, stockOnHand } from "./queries";

export async function procurementList(
  org: string,
  kind: DocumentKind,
  projectId?: string,
  params: ListParams = {},
) {
  const permission = kind === "transfers" ? "inventory.view" : "purchase.view";
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  if (projectId) assertPermission(ctx, permission);
  const projects = await db.project.findMany({
    where: {
      ...moduleProjectWhere(ctx, permission),
      ...(projectId ? { id: projectId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const input = listParams(params);
  const projectIds = projects.map((project) => project.id);
  const where = {
    organizationId: ctx.org.id,
    projectId: { in: projectIds },
    ...procurementSearchWhere(input.search, kind),
  };
  const count =
    kind === "requests"
      ? db.purchaseRequest.count({ where })
      : kind === "orders"
        ? db.purchaseOrder.count({ where })
        : kind === "receipts"
          ? db.goodsReceipt.count({ where })
          : db.stockTransfer.count({ where });
  const total = await count;
  const page = pageInfo(total, input);
  const skip = (page.page - 1) * page.pageSize;
  const orderBy = procurementOrderBy(
    procurementSortKeys.includes(input.sort) ? input.sort : "date",
    input.direction,
  );
  const rows =
    kind === "requests"
      ? await db.purchaseRequest.findMany({
          where,
          include: { project: true },
          orderBy: [orderBy, { id: "desc" }],
          skip,
          take: page.pageSize,
        })
      : kind === "orders"
        ? await db.purchaseOrder.findMany({
            where,
            include: { project: true, vendor: true },
            orderBy: [orderBy, { id: "desc" }],
            skip,
            take: page.pageSize,
          })
        : kind === "receipts"
          ? await db.goodsReceipt.findMany({
              where,
              include: { project: true, order: true },
              orderBy: [orderBy, { id: "desc" }],
              skip,
              take: page.pageSize,
            })
          : await db.stockTransfer.findMany({
              where,
              include: { project: true, toProject: true },
              orderBy: [orderBy, { id: "desc" }],
              skip,
              take: page.pageSize,
            });
  return {
    ctx,
    projects,
    rows,
    page: { ...page, sortKeys: procurementSortKeys },
    baseCurrency: ctx.org.baseCurrency,
  };
}

export async function inventoryData(
  org: string,
  projectId: string | undefined,
  kind: "stock" | "consumption" | "materials",
  params: ListParams = {},
) {
  const d = await procurementData(
    org,
    projectId,
    true,
    "transfers",
    false,
    kind !== "stock",
  );
  const input = listParams(params);
  const projectIds = d.projects.map((project) => project.id);
  const stockRows =
    kind === "consumption" ? [] : await stockOnHand(d.ctx, projectIds);
  const projectNames = new Map(
    d.projects.map((project) => [project.id, project.name]),
  );
  const stock = stockRows.map((row) => ({
    id: `${row.projectId}:${row.variantId}`,
    project: projectNames.get(row.projectId) ?? "",
    name: row.name,
    qty: row.qty,
    uom: row.uom,
    avgCost: row.avgCost,
    value: row.value,
  }));
  const stockSearch = input.search.toLocaleLowerCase();
  const filteredStock = stock.filter(
    (row) =>
      !stockSearch ||
      `${row.project} ${row.name}`.toLocaleLowerCase().includes(stockSearch),
  );
  if (["project", "name", "qty", "avgCost", "value"].includes(input.sort)) {
    const key = input.sort as "project" | "name" | "qty" | "avgCost" | "value";
    filteredStock.sort((a, b) => {
      const order =
        key === "project" || key === "name"
          ? a[key].localeCompare(b[key])
          : new Decimal(a[key]).cmp(b[key]);
      return (
        (input.direction === "asc" ? order : -order) || a.id.localeCompare(b.id)
      );
    });
  }
  const stockPage = pageInfo(filteredStock.length, input);
  const pagedStock = filteredStock.slice(
    (stockPage.page - 1) * stockPage.pageSize,
    stockPage.page * stockPage.pageSize,
  );

  const usageWhere = {
    consumption: {
      organizationId: d.ctx.org.id,
      projectId: { in: projectIds },
    },
    ...(input.search
      ? {
          OR: [
            {
              consumption: {
                code: { contains: input.search, mode: "insensitive" as const },
              },
            },
            {
              consumption: {
                project: {
                  name: {
                    contains: input.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              variant: {
                name: { contains: input.search, mode: "insensitive" as const },
              },
            },
            {
              consumption: {
                stage: {
                  name: {
                    contains: input.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              consumption: {
                task: {
                  title: {
                    contains: input.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const usageTotal =
    kind === "stock"
      ? 0
      : await db.materialConsumptionLine.count({ where: usageWhere });
  const usagePage = pageInfo(usageTotal, input);
  const usageRows =
    kind === "stock"
      ? []
      : await db.materialConsumptionLine.findMany({
          where: usageWhere,
          include: {
            uom: true,
            variant: true,
            consumption: {
              include: { project: true, stage: true, task: true },
            },
          },
          orderBy: [
            input.sort === "code"
              ? { consumption: { code: input.direction } }
              : input.sort === "project"
                ? { consumption: { project: { name: input.direction } } }
                : { consumption: { date: input.direction } },
            { id: "desc" },
          ],
          skip: (usagePage.page - 1) * usagePage.pageSize,
          take: usagePage.pageSize,
        });
  const history = usageRows.map((line) => ({
    id: line.id,
    code: line.consumption.code,
    project: line.consumption.project.name,
    date: line.consumption.date.toISOString(),
    stage: line.consumption.stage?.name ?? "Unallocated",
    task: line.consumption.task?.title ?? "",
    item: line.variant.name,
    qty: line.qty.toString(),
    uom: line.uom.code,
    value: line.totalCost.toString(),
  }));
  const purchaseProjects =
    kind === "materials"
      ? await db.project.findMany({
          where: {
            ...moduleProjectWhere(d.ctx, "purchase.view"),
            id: { in: projectIds },
          },
          select: { id: true },
        })
      : [];
  const purchaseProjectIds = purchaseProjects.map((project) => project.id);
  const documents =
    kind === "materials"
      ? await Promise.all([
          db.purchaseRequest.findMany({
            where: {
              organizationId: d.ctx.org.id,
              projectId: { in: purchaseProjectIds },
            },
            select: { id: true, code: true, status: true, projectId: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
          db.purchaseOrder.findMany({
            where: {
              organizationId: d.ctx.org.id,
              projectId: { in: purchaseProjectIds },
            },
            select: { id: true, code: true, status: true, projectId: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
          db.goodsReceipt.findMany({
            where: {
              organizationId: d.ctx.org.id,
              projectId: { in: purchaseProjectIds },
            },
            select: { id: true, code: true, status: true, projectId: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
        ])
      : [[], [], []];
  return {
    ...d,
    stock: pagedStock,
    stockPage: {
      ...stockPage,
      sortKeys: ["project", "name", "qty", "avgCost", "value"],
    },
    history,
    usagePage: { ...usagePage, sortKeys: ["code", "project", "date"] },
    documents,
    projectNames,
  };
}
