"use server";

import { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { typedAction } from "@/core/typed-action";
import { adjustmentInput } from "../adjustment-schema";
import { recordStockAdjustment } from "./inventory/adjustment-service";

export async function recordStockAdjustmentAction(
  org: string,
  input: z.input<typeof adjustmentInput>,
) {
  return typedAction(adjustmentInput, async (parsed) => {
    const ctx = await requireProjectContext(org, parsed.projectId);
    await db.$transaction((tx) => recordStockAdjustment(tx, ctx, parsed), {
      timeout: 20000,
    });
    return undefined;
  })(input);
}

export async function findAdjustmentVariants(
  org: string,
  projectId: string,
  query: string,
) {
  const ctx = await requireProjectContext(org, id.parse(projectId));
  assertPermission(ctx, "inventory.adjust");
  const search = z.string().max(150).parse(query).trim();
  const rows = await db.itemVariant.findMany({
    where: {
      name: { contains: search, mode: "insensitive" },
      item: { tenantId: ctx.tenant.id, stockTracked: true },
    },
    include: { item: { select: { stockUom: { select: { code: true } } } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 50,
  });
  return rows.map((row) => ({
    value: row.id,
    label: row.name,
    description: `Stock unit: ${row.item.stockUom.code}`,
  }));
}
