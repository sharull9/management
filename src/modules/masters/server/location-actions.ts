"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";

import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { id, saveCityInput } from "../schema";
export async function saveCityAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "masters.manage");
    const input = saveCityInput.parse(Object.fromEntries(data));
    const cityId = optional(data, "id");
    await db.$transaction(async (tx) => {
      if (
        cityId &&
        !(await tx.city.findFirst({
          where: { id: cityId, tenantId: ctx.tenant.id },
        }))
      )
        throw new Error("City not found.");
      const city = cityId
        ? await tx.city.update({ where: { id: cityId }, data: input })
        : await tx.city.create({ data: { ...input, tenantId: ctx.tenant.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: cityId ? "UPDATE" : "CREATE",
          entityType: "City",
          entityId: city.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function deleteCityAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "masters.manage");
    const cityId = id.parse(data.get("id"));
    await db.$transaction(async (tx) => {
      const city = await tx.city.findFirstOrThrow({
        where: { id: cityId, tenantId: ctx.tenant.id },
      });
      await tx.city.delete({ where: { id: city.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "DELETE",
          entityType: "City",
          entityId: city.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
