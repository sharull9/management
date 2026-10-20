import "server-only";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { serialiseMasterData } from "./serialise";
export async function masterData(org: string) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "masters.manage");
  const tenantId = ctx.tenant.id;
  const [
    groups,
    uoms,
    categories,
    levels,
    items,
    parties,
    components,
    taxGroups,
    countries,
    states,
    cities,
  ] = await Promise.all([
    db.uomGroup.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { name: "asc" },
    }),
    db.uom.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      include: { group: true },
      orderBy: { name: "asc" },
    }),
    db.itemCategory.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.itemLevelDefinition.findMany({
      where: { tenantId },
      include: { values: { orderBy: { name: "asc" } } },
      orderBy: { level: "asc" },
    }),
    db.item.findMany({
      where: { tenantId },
      include: {
        levelConfigs: { include: { links: true } },
        variants: true,
        stockUom: true,
      },
      orderBy: { name: "asc" },
    }),
    db.party.findMany({
      where: { tenantId },
      include: { addresses: true, contacts: true, taxIdentifiers: true },
      orderBy: { displayName: "asc" },
    }),
    db.taxComponent.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.taxGroup.findMany({
      where: { tenantId },
      include: { components: true },
      orderBy: { name: "asc" },
    }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.state.findMany({ orderBy: { name: "asc" } }),
    db.city.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);
  return serialiseMasterData({
    groups,
    uoms,
    categories,
    levels,
    items,
    parties,
    components,
    taxGroups,
    countries,
    states,
    cities,
  });
}
export async function pickerItems(
  tenantId: string,
  options: {
    stockOnly?: boolean;
    search?: string;
    take?: number;
    selectedIds?: string[];
  } = {},
) {
  const search = options.search?.trim();
  const include = {
    levelConfigs: {
      include: { definition: { include: { values: true } }, links: true },
    },
  } as const;
  const items = await db.item.findMany({
    where: {
      tenantId,
      active: true,
      ...(options.stockOnly ? { stockTracked: true } : {}),
      ...(search ? { OR: itemSearch(search) } : {}),
    },
    include,
    orderBy: { name: "asc" },
    ...(options.take ? { take: options.take } : {}),
  });
  const selectedIds = (options.selectedIds ?? []).filter(
    (id) => !items.some((item) => item.id === id),
  );
  const selected = selectedIds.length
    ? await db.item.findMany({
        where: { tenantId, id: { in: selectedIds } },
        include,
      })
    : [];
  return [...items, ...selected].map((i) => ({
    id: i.id,
    name: `${i.code} · ${i.name}`,
    stockUomId: i.stockUomId,
    purchaseUomId: i.purchaseUomId,
    defaultTaxGroupId: i.defaultTaxGroupId,
    configs: i.levelConfigs.map((c) => ({
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
function itemSearch(search: string) {
  return [
    { name: { contains: search, mode: "insensitive" as const } },
    { code: { contains: search, mode: "insensitive" as const } },
  ];
}
