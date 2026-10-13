"use server";
import { z } from "zod";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";

const isoDate = z.iso.date();
const code = z.string().regex(/^[A-Z]{3}$/);

export type FxPreview = {
  baseCurrency: string;
  /** Base units per 1 unit of `currency`; null when no dated rate exists. */
  exchangeRate: string | null;
  rateDate: string | null;
};

/** Rate the document would resolve to on `date` (latest on or before it). */
export async function previewDocumentFx(
  org: string,
  currency: string,
  date: string,
): Promise<FxPreview> {
  const input = { currency: code.parse(currency), date: isoDate.parse(date) };
  const ctx = await requireOrgContext(org);
  const baseCurrency = ctx.org.baseCurrency;
  if (input.currency === baseCurrency)
    return { baseCurrency, exchangeRate: "1", rateDate: null };
  const row = await db.exchangeRate.findFirst({
    where: {
      organizationId: ctx.org.id,
      currencyCode: input.currency,
      rateDate: { lte: new Date(`${input.date}T00:00:00Z`) },
    },
    orderBy: { rateDate: "desc" },
    select: { rate: true, rateDate: true },
  });
  return {
    baseCurrency,
    exchangeRate: row ? row.rate.toString() : null,
    rateDate: row ? row.rateDate.toISOString().slice(0, 10) : null,
  };
}

/** The party's default currency, or null (callers fall back to the base currency). */
export async function partyDefaultCurrency(org: string, partyId: string) {
  const id = z.string().min(1).max(100).parse(partyId);
  const ctx = await requireOrgContext(org);
  const party = await db.party.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { defaultCurrency: true },
  });
  return party?.defaultCurrency ?? null;
}
