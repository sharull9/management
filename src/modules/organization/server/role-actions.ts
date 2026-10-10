"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";

import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { id, saveRoleInput } from "../schema";
export async function saveRoleAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "roles.manage");
    const input = saveRoleInput.parse({
      ...Object.fromEntries(data),
      permissions: data.getAll("permissions"),
    });
    const roleId = optional(data, "id");
    if (!ctx.isAdmin && input.permissions.some((p) => !ctx.permissions.has(p)))
      throw new Error("You may only grant permissions you hold.");
    await db.$transaction(async (tx) => {
      if (roleId) {
        const role = await tx.role.findFirstOrThrow({
          where: { id: roleId, tenantId: ctx.tenant.id },
          include: { members: true, projectMembers: true },
        });
        if (!ctx.isAdmin && (role.members.length || role.projectMembers.length))
          throw new Error("Only administrators can edit assigned roles.");
      }
      const role = roleId
        ? await tx.role.update({ where: { id: roleId }, data: input })
        : await tx.role.create({ data: { ...input, tenantId: ctx.tenant.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: roleId ? "UPDATE" : "CREATE",
          entityType: "Role",
          entityId: role.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function deleteRoleAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "roles.manage");
    const roleId = id.parse(data.get("id"));
    await db.$transaction(async (tx) => {
      const role = await tx.role.findFirstOrThrow({
        where: { id: roleId, tenantId: ctx.tenant.id },
        include: { members: true, projectMembers: true },
      });
      if (role.members.length || role.projectMembers.length)
        throw new Error("Unassign this role from members before deleting it.");
      await tx.role.delete({ where: { id: role.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "DELETE",
          entityType: "Role",
          entityId: role.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
