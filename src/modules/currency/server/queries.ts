import "server-only";
import { db } from "@/core/db";
import type { CurrencyRow, ExchangeRateRow, TenantCurrencyRow } from "../type";

const currencySelect = {
  code: true,
  name: true,
  symbol: true,
  decimals: true,
  active: true,
} as const;

/** The global master, active currencies only. */
export async function listCurrencies(): Promise<CurrencyRow[]> {
  return db.currency.findMany({
    where: { active: true },
    select: currencySelect,
    orderBy: { code: "asc" },
  });
}

/** Active currencies with the tenant's enabled flag (false when never enabled). */
export async function listTenantCurrencies(
  tenantId: string,
): Promise<TenantCurrencyRow[]> {
  const [currencies, enabled] = await Promise.all([
    listCurrencies(),
    db.tenantCurrency.findMany({
      where: { tenantId, enabled: true },
      select: { currencyCode: true },
    }),
  ]);
  const on = new Set(enabled.map((row) => row.currencyCode));
  return currencies.map((currency) => ({
    ...currency,
    enabled: on.has(currency.code),
  }));
}

/** Currencies the tenant may use on documents, base currency first. */
export async function listEnabledCurrencies(
  tenantId: string,
  baseCurrency?: string,
): Promise<CurrencyRow[]> {
  const rows = await db.currency.findMany({
    where: {
      active: true,
      tenantCurrencies: { some: { tenantId, enabled: true } },
    },
    select: currencySelect,
    orderBy: { code: "asc" },
  });
  return baseCurrency
    ? [
        ...rows.filter((row) => row.code === baseCurrency),
        ...rows.filter((row) => row.code !== baseCurrency),
      ]
    : rows;
}

export type ExchangeRateFilters = {
  currencyCode?: string;
  /** Inclusive `YYYY-MM-DD` bounds on the rate date. */
  from?: string;
  to?: string;
};

export async function listExchangeRates(
  organizationId: string,
  filters: ExchangeRateFilters | string = {},
): Promise<ExchangeRateRow[]> {
  const { currencyCode, from, to } =
    typeof filters === "string" ? { currencyCode: filters } : filters;
  const rows = await db.exchangeRate.findMany({
    where: {
      organizationId,
      ...(currencyCode ? { currencyCode } : {}),
      ...(from || to
        ? {
            rateDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      currencyCode: true,
      rateDate: true,
      rate: true,
      createdBy: { select: { name: true } },
    },
    orderBy: [{ rateDate: "desc" }, { currencyCode: "asc" }],
  });
  return rows.map(({ createdBy, ...row }) => ({
    ...row,
    rate: row.rate.toString(),
    createdByName: createdBy.name,
  }));
}

/** The most recent rate of each currency, by rate date. */
export async function latestExchangeRates(
  organizationId: string,
): Promise<ExchangeRateRow[]> {
  const rows = await listExchangeRates(organizationId);
  const seen = new Set<string>();
  // Rows arrive newest first, so the first row per currency is its latest.
  return rows
    .filter((row) => {
      if (seen.has(row.currencyCode)) return false;
      seen.add(row.currencyCode);
      return true;
    })
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

/**
 * Currencies the tenant has ever chosen, enabled or not, plus the rest of the
 * active master that can still be added.
 */
export async function listCurrencySettings(tenantId: string): Promise<{
  tenant: TenantCurrencyRow[];
  available: CurrencyRow[];
}> {
  const [currencies, rows] = await Promise.all([
    listCurrencies(),
    db.tenantCurrency.findMany({
      where: { tenantId },
      select: { currencyCode: true, enabled: true },
    }),
  ]);
  const state = new Map(rows.map((row) => [row.currencyCode, row.enabled]));
  return {
    tenant: currencies
      .filter((currency) => state.has(currency.code))
      .map((currency) => ({
        ...currency,
        enabled: state.get(currency.code) === true,
      })),
    available: currencies.filter((currency) => !state.has(currency.code)),
  };
}
