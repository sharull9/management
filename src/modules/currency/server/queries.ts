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

export async function listExchangeRates(
  organizationId: string,
  currencyCode?: string,
): Promise<ExchangeRateRow[]> {
  const rows = await db.exchangeRate.findMany({
    where: { organizationId, ...(currencyCode ? { currencyCode } : {}) },
    select: { id: true, currencyCode: true, rateDate: true, rate: true },
    orderBy: [{ rateDate: "desc" }, { currencyCode: "asc" }],
  });
  return rows.map((row) => ({ ...row, rate: row.rate.toString() }));
}
