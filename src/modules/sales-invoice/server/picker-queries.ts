import "server-only";
import { db } from "@/core/db";
export async function invoiceItems(
  tenantId: string,
  search = "",
  ids?: string[],
) {
  const items = await db.item.findMany({
    where: {
      tenantId,
      active: true,
      ...(ids ? { id: { in: ids } } : {}),
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
    take: ids ? undefined : 30,
  });
  return items.map((item) => ({
    id: item.id,
    name: `${item.code} / ${item.name}`,
    stockUomId: item.stockUomId,
    purchaseUomId: item.purchaseUomId,
    defaultTaxGroupId: item.defaultTaxGroupId,
    configs: item.levelConfigs.map((config) => ({
      level: config.definition.level,
      name: config.definition.name,
      enabled: config.definition.enabled,
      mode: config.mode,
      required: config.required,
      values: config.definition.values.map((value) => ({
        id: value.id,
        name: value.name,
      })),
      linkedIds: config.links.map((link) => link.valueId),
    })),
  }));
}
