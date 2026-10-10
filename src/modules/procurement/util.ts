import type { procurementData } from "./server/queries";
import type { ProcurementFormData } from "./type";

type Data = Awaited<ReturnType<typeof procurementData>>;
export const selectedLevels = (v: {
  level1Id: string | null;
  level2Id: string | null;
  level3Id: string | null;
  level4Id: string | null;
  level5Id: string | null;
}) => [v.level1Id, v.level2Id, v.level3Id, v.level4Id, v.level5Id];
export function formData(d: Data): ProcurementFormData {
  return {
    projects: d.projects.map((p) => ({
      id: p.id,
      name: `${p.code} · ${p.name}`,
      currency: p.currency,
    })),
    items: d.items,
    uoms: d.uoms.map((u) => ({ id: u.id, name: `${u.code} · ${u.name}` })),
    vendors: d.vendors.map((v) => ({ id: v.id, name: v.displayName })),
    groups: d.groups.map((g) => ({ id: g.id, name: g.name, scope: g.scope })),
    sites: d.sites.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
    })),
    stages: d.stages.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
    })),
    tasks: d.tasks.map((t) => ({
      id: t.id,
      name: `${t.code} · ${t.title}`,
      projectId: t.projectId,
    })),
    taxSuggestions: d.taxSuggestions,
    prLines: d.requests
      .filter((r) => r.status === "APPROVED")
      .flatMap((r) =>
        r.lines.map((l) => ({
          id: l.id,
          name: `${r.code} · ${l.variant.name}`,
          projectId: r.projectId,
          line: {
            itemId: l.variant.itemId,
            levels: selectedLevels(l.variant),
            qty: l.qty.toString(),
            uomId: l.uomId,
            description: l.description,
            rate: l.estimatedRate.toString(),
            discountPercent: "0",
            taxGroupId: null,
            prLineId: l.id,
          },
        })),
      ),
    orders: d.orders
      .filter(
        (o) => o.status === "APPROVED" || o.status === "PARTIALLY_RECEIVED",
      )
      .map((o) => ({
        id: o.id,
        name: `${o.code} · ${o.vendor.displayName}`,
        projectId: o.projectId,
        lines: o.lines
          .filter((l) => l.receivedQty.lt(l.qty))
          .map((l) => ({
            id: l.id,
            name: l.variant.name,
            uomId: l.uomId,
            pending: l.qty.sub(l.receivedQty).toString(),
          })),
      })),
  };
}
