"use server";

import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { typedAction } from "@/core/typed-action";

import { deleteCityInput, saveCityInput } from "../schema";
export async function saveCityAction(
  orgSlug: string,
  data: z.input<typeof saveCityInput>,
) {
  return typedAction(saveCityInput, async ({ id: cityId, ...input }) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "masters.manage");
    await db.$transaction(async (tx) => {
      if (
        cityId &&
        !(await tx.city.findFirst({
          where: { id: cityId, tenantId: ctx.tenant.id },
        }))
      )
        throw new UserFacingError("City not found.");
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
  })(data);
}
export async function deleteCityAction(
  orgSlug: string,
  data: z.input<typeof deleteCityInput>,
) {
  return typedAction(deleteCityInput, async ({ id: cityId }) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "masters.manage");
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
  })(data);
}
