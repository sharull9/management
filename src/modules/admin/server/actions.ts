"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";

import { requireSuperAdmin } from "@/core/context";
import { db } from "@/core/db";

import { provisionUser } from "@/modules/organization/server/provision-user";
import { createTenantInput, credentials, tenantStatusInput } from "../schema";
export async function createTenantAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const actor = await requireSuperAdmin();
    const input = createTenantInput.parse(Object.fromEntries(data));
    await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: input.email },
      });
      const owner =
        existing ??
        (await provisionUser(
          credentials.parse({
            name: input.ownerName,
            email: input.email,
            password: input.password,
          }),
          tx,
          actor.id,
        ));
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          members: { create: { userId: owner.id, role: "OWNER" } },
        },
      });
      await writeAudit(
        {
          tenantId: tenant.id,
          userId: actor.id,
          action: "CREATE",
          entityType: "Tenant",
          entityId: tenant.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function tenantStatusAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const actor = await requireSuperAdmin();
    const input = tenantStatusInput.parse(Object.fromEntries(data));
    await db.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: { status: input.status },
      });
      await writeAudit(
        {
          tenantId: input.tenantId,
          userId: actor.id,
          action: input.status,
          entityType: "Tenant",
          entityId: input.tenantId,
        },
        tx,
      );
    });
    return undefined;
  });
}
