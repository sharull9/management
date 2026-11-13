import "server-only";
import type { OrgContext } from "@/core/context";
import { db } from "@/core/db";
import { type ListParams, listParams, pageInfo } from "@/core/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { moduleProjectWhere } from "./queries";

export async function stockAdjustmentData(
  ctx: OrgContext,
  projectIds: string[],
  params: ListParams = {},
) {
  const input = listParams(params);
  const where: Prisma.StockMovementWhereInput = {
    organizationId: ctx.org.id,
    projectId: { in: projectIds },
    type: "ADJUSTMENT",
    ...(input.search
      ? {
          OR: [
            { reason: { contains: input.search, mode: "insensitive" } },
            {
              variant: {
                name: { contains: input.search, mode: "insensitive" },
              },
            },
            {
              project: {
                name: { contains: input.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
  const [total, writableProjects] = await Promise.all([
    db.stockMovement.count({ where }),
    db.project.findMany({
      where: {
        ...moduleProjectWhere(ctx, "inventory.adjust"),
        id: { in: projectIds },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const page = pageInfo(total, input);
  const rows = await db.stockMovement.findMany({
    where,
    include: {
      project: { select: { name: true } },
      variant: {
        select: {
          name: true,
          item: { select: { stockUom: { select: { code: true } } } },
        },
      },
      recordedBy: { select: { name: true } },
    },
    orderBy: [
      { date: input.direction },
      { createdAt: input.direction },
      { id: "desc" },
    ],
    skip: (page.page - 1) * page.pageSize,
    take: page.pageSize,
  });
  return {
    writableProjects,
    page,
    rows: rows.map((row) => ({
      id: row.id,
      project: row.project.name,
      item: row.variant.name,
      date: row.date.toISOString().slice(0, 10),
      qty: row.qty.toString(),
      uom: row.variant.item.stockUom.code,
      value: row.totalCost.toString(),
      reason: row.reason ?? "",
      recordedBy: row.recordedBy?.name ?? "Unknown user",
    })),
  };
}
