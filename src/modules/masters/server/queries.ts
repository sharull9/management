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
export async function pickerItems(tenantId: string, stockOnly = false) {
  const items = await db.item.findMany({
    where: {
      tenantId,
      active: true,
      ...(stockOnly ? { stockTracked: true } : {}),
    },
    include: {
      levelConfigs: {
        include: { definition: { include: { values: true } }, links: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return items.map((i) => ({
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
