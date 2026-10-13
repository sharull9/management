"use server";

import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import {
  assertTenantAdmin,
  requireOrgContext,
  requireUser,
} from "@/core/context";
import { db } from "@/core/db";
import { typedAction } from "@/core/typed-action";
import { assertBaseCurrencyChangeAllowed } from "@/modules/currency/server/base-currency";
import { assertStorableCurrency } from "@/modules/currency/util";

import { orgInput } from "../schema";
export async function saveOrganizationAction(
  orgSlug: string | null,
  input: z.input<typeof orgInput>,
) {
  return typedAction(orgInput, async (input) => {
    const user = await requireUser();
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
    const { id: orgId, ...organizationData } = input;
    const org = await db.$transaction(async (tx) => {
      if (
        orgId &&
        !(await tx.organization.findFirst({
          where: { id: orgId, tenantId: input.tenantId },
        }))
      )
        throw new Error("Organization not found.");
      const currency = await tx.currency.findUnique({
        where: { code: organizationData.baseCurrency },
      });
      if (!currency?.active)
        throw new Error(
          `Currency ${organizationData.baseCurrency} is not available.`,
        );
      assertStorableCurrency(currency.code, currency.decimals);
      if (orgId) {
        const current = await tx.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { baseCurrency: true },
        });
        if (current.baseCurrency !== organizationData.baseCurrency)
          await assertBaseCurrencyChangeAllowed(tx, orgId);
      }
      // The base currency is always enabled for its tenant.
      await tx.tenantCurrency.upsert({
        where: {
          tenantId_currencyCode: {
            tenantId: input.tenantId,
            currencyCode: organizationData.baseCurrency,
          },
        },
        create: {
          tenantId: input.tenantId,
          currencyCode: organizationData.baseCurrency,
          enabled: true,
        },
        update: { enabled: true },
      });
      const saved = orgId
        ? await tx.organization.update({
            where: { id: orgId },
            data: organizationData,
          })
        : await tx.organization.create({
            data: {
              ...organizationData,
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
  })(input);
}
