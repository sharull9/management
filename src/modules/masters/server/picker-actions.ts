"use server";
import { z } from "zod";
import type { PickerItem } from "@/components/shared/form/item-variant-value";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
export async function findItems(
  org: string,
  query: string,
): Promise<PickerItem[]> {
  const search = z.string().max(150).parse(query);
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "masters.manage");
  const items = await db.item.findMany({
    where: {
      tenantId: ctx.tenant.id,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    },
    include: {
      levelConfigs: {
        include: { definition: { include: { values: true } }, links: true },
      },
    },
    orderBy: { name: "asc" },
    take: 50,
  });
  return items.map((item) => ({
    id: item.id,
    name: `${item.code} · ${item.name}`,
    configs: item.levelConfigs.map((c) => ({
      level: c.definition.level,
      name: c.definition.name,
      enabled: c.definition.enabled,
      mode: c.mode,
      required: c.required,
      values: c.definition.values.map((v) => ({ id: v.id, name: v.name })),
      linkedIds: c.links.map((l) => l.valueId),
    })),
  }));
}
