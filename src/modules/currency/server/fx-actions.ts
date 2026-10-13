"use server";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { exchangeRatePreviewInput } from "../schema";
import { resolveRateWithDate } from "./rates";

export type ExchangeRatePreview = {
  baseCurrency: string;
  /** Base units per 1 unit of `currency`; null when no dated rate exists. */
  exchangeRate: string | null;
  /** Date of the rate row it came from; null for the base currency. */
  rateDate: string | null;
  /** Why no rate is available. */
  error: string | null;
};

/**
 * The rate a document would resolve to on `date` (latest on or before it), for
 * prefilling document forms. Scoped to the caller's organization; a missing
 * rate is reported as `error`, not thrown.
 */
export async function previewExchangeRate(
  org: string,
  input: { currency: string; date: string },
): Promise<ExchangeRatePreview> {
  const { currency, date } = exchangeRatePreviewInput.parse(input);
  const ctx = await requireOrgContext(org);
  const baseCurrency = ctx.org.baseCurrency;
  try {
    const { rate, rateDate } = await resolveRateWithDate(
      db,
      ctx.org.id,
      currency,
      date,
    );
    return {
      baseCurrency,
      exchangeRate: rate.toString(),
      rateDate,
      error: null,
    };
  } catch (error) {
    return {
      baseCurrency,
      exchangeRate: null,
      rateDate: null,
      error: error instanceof Error ? error.message : "Rate unavailable.",
    };
  }
}
