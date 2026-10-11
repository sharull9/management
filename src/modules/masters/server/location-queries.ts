import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";

/** State options for the city form, labelled "IN · Kerala". */
export async function stateOptions(org: string) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "masters.manage");
  const states = await db.state.findMany({
    include: { country: true },
    orderBy: { name: "asc" },
  });
  return states.map((s) => ({
    value: s.id,
    label: `${s.country.code} · ${s.name}`,
  }));
}
