"use server";

import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { typedAction } from "@/core/typed-action";
import type { Prisma } from "@/generated/prisma/client";
import {
  baseCurrencyInput,
  deleteExchangeRateInput,
  exchangeRateInput,
  tenantCurrencyInput,
} from "../schema";
import { assertStorableCurrency } from "../util";
import { assertBaseCurrencyChangeAllowed } from "./base-currency";
import { assertEnabledCurrency } from "./enabled";

async function activeCurrency(tx: Prisma.TransactionClient, code: string) {
  const currency = await tx.currency.findUnique({ where: { code } });
  if (!currency?.active)
    throw new UserFacingError(`Currency ${code} is not available.`);
  assertStorableCurrency(code, currency.decimals);
  return currency;
}

export async function setTenantCurrencyAction(
  orgSlug: string,
  input: z.input<typeof tenantCurrencyInput>,
) {
  return typedAction(tenantCurrencyInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "currency.manage");
    await db.$transaction(async (tx) => {
      await activeCurrency(tx, input.currencyCode);
      if (!input.enabled) {
        const [asBase, asProject, asParty] = await Promise.all([
          tx.organization.count({
            where: {
              tenantId: ctx.tenant.id,
              baseCurrency: input.currencyCode,
            },
          }),
          tx.project.count({
            where: {
              organization: { tenantId: ctx.tenant.id },
              currency: input.currencyCode,
            },
          }),
          tx.party.count({
            where: {
              tenantId: ctx.tenant.id,
              defaultCurrency: input.currencyCode,
            },
          }),
        ]);
        if (asBase)
          throw new UserFacingError(
            "A base currency of one of the organizations cannot be disabled.",
          );
        if (asProject || asParty)
          throw new UserFacingError(
            "This currency is still used by projects or party defaults.",
          );
      }
      const row = await tx.tenantCurrency.upsert({
        where: {
          tenantId_currencyCode: {
            tenantId: ctx.tenant.id,
            currencyCode: input.currencyCode,
          },
        },
        create: {
          tenantId: ctx.tenant.id,
          currencyCode: input.currencyCode,
          enabled: input.enabled,
        },
        update: { enabled: input.enabled },
      });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: input.enabled ? "ENABLE" : "DISABLE",
          entityType: "TenantCurrency",
          entityId: row.id,
        },
        tx,
      );
    });
    return undefined;
  })(input);
}

export async function setBaseCurrencyAction(
  orgSlug: string,
  input: z.input<typeof baseCurrencyInput>,
) {
  return typedAction(baseCurrencyInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "currency.manage");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.org.id} FOR UPDATE`;
      const current = await tx.organization.findUniqueOrThrow({
        where: { id: ctx.org.id },
        select: { baseCurrency: true },
      });
      if (current.baseCurrency === input.currencyCode) return;
      await activeCurrency(tx, input.currencyCode);
      await assertBaseCurrencyChangeAllowed(tx, ctx.org.id);
      await tx.tenantCurrency.upsert({
        where: {
          tenantId_currencyCode: {
            tenantId: ctx.tenant.id,
            currencyCode: input.currencyCode,
          },
        },
        create: {
          tenantId: ctx.tenant.id,
          currencyCode: input.currencyCode,
          enabled: true,
        },
        update: { enabled: true },
      });
      await tx.organization.update({
        where: { id: ctx.org.id },
        data: { baseCurrency: input.currencyCode },
      });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "SET_BASE_CURRENCY",
          entityType: "Organization",
          entityId: ctx.org.id,
          changes: { from: current.baseCurrency, to: input.currencyCode },
        },
        tx,
      );
    });
    return undefined;
  })(input);
}

export async function saveExchangeRateAction(
  orgSlug: string,
  input: z.input<typeof exchangeRateInput>,
) {
  return typedAction(exchangeRateInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "exchangeRate.manage");
    if (input.currencyCode === ctx.org.baseCurrency)
      throw new UserFacingError("The base currency always has a rate of 1.");
    await db.$transaction(async (tx) => {
      await activeCurrency(tx, input.currencyCode);
      await assertEnabledCurrency(tx, ctx.tenant.id, input.currencyCode);
      const data = {
        currencyCode: input.currencyCode,
        rateDate: input.rateDate,
        rate: input.rate,
      };
      if (input.id) {
        const existing = await tx.exchangeRate.findFirst({
          where: { id: input.id, organizationId: ctx.org.id },
        });
        if (!existing) throw new UserFacingError("Exchange rate not found.");
      }
      const row = input.id
        ? await tx.exchangeRate.update({ where: { id: input.id }, data })
        : await tx.exchangeRate.upsert({
            where: {
              organizationId_currencyCode_rateDate: {
                organizationId: ctx.org.id,
                currencyCode: input.currencyCode,
                rateDate: input.rateDate,
              },
            },
            create: {
              ...data,
              organizationId: ctx.org.id,
              createdById: ctx.user.id,
            },
            update: { rate: input.rate },
          });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "UPSERT",
          entityType: "ExchangeRate",
          entityId: row.id,
        },
        tx,
      );
    });
    return undefined;
  })(input);
}

export async function deleteExchangeRateAction(
  orgSlug: string,
  input: z.input<typeof deleteExchangeRateInput>,
) {
  return typedAction(deleteExchangeRateInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "exchangeRate.manage");
    await db.$transaction(async (tx) => {
      const existing = await tx.exchangeRate.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      });
      if (!existing) throw new UserFacingError("Exchange rate not found.");
      await tx.exchangeRate.delete({ where: { id: existing.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "DELETE",
          entityType: "ExchangeRate",
          entityId: existing.id,
        },
        tx,
      );
    });
    return undefined;
  })(input);
}
