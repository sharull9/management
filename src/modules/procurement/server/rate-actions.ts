"use server";

import { z } from "zod";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { organizationBaseCurrency } from "@/modules/currency/server/rates";

const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type RateSuggestion = {
  /** Base units per 1 document unit; null when no rate is available. */
  rate: string | null;
  /** Date of the exchange rate row the suggestion came from. */
  rateDate: string | null;
  baseCurrency: string;
  error: string | null;
};

/** The latest organization rate on or before `date`, for prefilling document forms. */
export async function suggestExchangeRate(
  org: string,
  input: { currency: string; date: string },
): Promise<RateSuggestion> {
  const currency = currencyCode.parse(input.currency);
  const date = day.parse(input.date);
  const ctx = await requireOrgContext(org);
  const base = await organizationBaseCurrency(db, ctx.org.id);
  if (currency === base.code)
    return { rate: "1", rateDate: null, baseCurrency: base.code, error: null };
  const row = await db.exchangeRate.findFirst({
    where: {
      organizationId: ctx.org.id,
      currencyCode: currency,
      rateDate: { lte: new Date(`${date}T00:00:00Z`) },
    },
    orderBy: { rateDate: "desc" },
    select: { rate: true, rateDate: true },
  });
  if (!row)
    return {
      rate: null,
      rateDate: null,
      baseCurrency: base.code,
      error: `No ${currency} exchange rate on or before ${date}. Add one in Settings → Exchange rates or enter a rate.`,
    };
  return {
    rate: row.rate.toString(),
    rateDate: row.rateDate.toISOString().slice(0, 10),
    baseCurrency: base.code,
    error: null,
  };
}

/** The vendor's default currency, or null when none is set. */
export async function vendorDefaultCurrency(org: string, vendorId: string) {
  const ctx = await requireOrgContext(org);
  const vendor = await db.party.findFirst({
    where: { id: id.parse(vendorId), tenantId: ctx.tenant.id, isVendor: true },
    select: { defaultCurrency: true },
  });
  return vendor?.defaultCurrency ?? null;
}

/** The currency of a purchase order in this organization (inherited by receipts). */
export async function purchaseOrderCurrency(org: string, orderId: string) {
  const ctx = await requireOrgContext(org);
  const order = await db.purchaseOrder.findFirst({
    where: { id: id.parse(orderId), organizationId: ctx.org.id },
    select: { currency: true },
  });
  return order?.currency ?? null;
}
