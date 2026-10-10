"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";

import {
  assertTenantAdmin,
  requireOrgContext,
  requireUser,
} from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";

import { orgInput } from "../schema";
export async function saveOrganizationAction(
  orgSlug: string | null,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const user = await requireUser();
    const input = orgInput.parse({
      ...Object.fromEntries(data),
      legalName: optional(data, "legalName"),
      countryId: optional(data, "countryId"),
      stateId: optional(data, "stateId"),
      cityId: optional(data, "cityId"),
      addressLine1: optional(data, "addressLine1"),
      addressLine2: optional(data, "addressLine2"),
      postalCode: optional(data, "postalCode"),
    });
    let currentOrgId: string | undefined;
    if (orgSlug) {
      const ctx = await requireOrgContext(orgSlug);
      assertTenantAdmin(ctx);
      if (ctx.tenant.id !== input.tenantId) throw new Error("Invalid tenant.");
      currentOrgId = ctx.org.id;
    } else {
      const membership = await db.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId: input.tenantId, userId: user.id },
        },
        include: { tenant: true },
      });
      if (
        !membership ||
        membership.role === "MEMBER" ||
        membership.tenant.status !== "ACTIVE"
      )
        throw new Error("Tenant administrator access is required.");
    }
    if (
      input.stateId &&
      !(await db.state.findFirst({
        where: { id: input.stateId, countryId: input.countryId ?? "" },
      }))
    )
      throw new Error("Select a state in the selected country.");
    if (
      input.cityId &&
      !(await db.city.findFirst({
        where: {
          id: input.cityId,
          tenantId: input.tenantId,
          stateId: input.stateId ?? "",
        },
      }))
    )
      throw new Error("Select a city in the selected state.");
    const orgId = optional(data, "id");
    const org = await db.$transaction(async (tx) => {
      if (
        orgId &&
        !(await tx.organization.findFirst({
          where: { id: orgId, tenantId: input.tenantId },
        }))
      )
        throw new Error("Organization not found.");
      const saved = orgId
        ? await tx.organization.update({ where: { id: orgId }, data: input })
        : await tx.organization.create({
            data: {
              ...input,
              members: { create: { userId: user.id, role: "owner" } },
            },
          });
      await writeAudit(
        {
          tenantId: input.tenantId,
          organizationId: saved.id,
          userId: user.id,
          action: orgId ? "UPDATE" : "CREATE",
          entityType: "Organization",
          entityId: saved.id,
        },
        tx,
      );
      return saved;
    });
    return !orgSlug || (orgSlug !== org.slug && orgId === currentOrgId)
      ? `/${org.slug}`
      : undefined;
  });
}
