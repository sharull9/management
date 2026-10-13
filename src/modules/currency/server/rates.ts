import { Decimal, type Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { assertPositiveRate, toBase } from "../util";

type Db = Prisma.TransactionClient;
const isoDate = (date: Date | string) =>
  typeof date === "string"
    ? date.slice(0, 10)
    : date.toISOString().slice(0, 10);

export async function organizationBaseCurrency(tx: Db, organizationId: string) {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { baseCurrencyRef: { select: { code: true, decimals: true } } },
  });
  return org.baseCurrencyRef;
}

/**
 * Base-currency units per 1 unit of `currencyCode`: the latest organization rate
 * on or before `date`. The base currency is exactly 1.
 */
export async function resolveRate(
  tx: Db,
  organizationId: string,
  currencyCode: string,
  date: Date | string,
) {
  const base = await organizationBaseCurrency(tx, organizationId);
  if (currencyCode === base.code) return new Decimal(1);
  const day = isoDate(date);
  const row = await tx.exchangeRate.findFirst({
    where: {
      organizationId,
      currencyCode,
      rateDate: { lte: new Date(`${day}T00:00:00Z`) },
    },
    orderBy: { rateDate: "desc" },
    select: { rate: true },
  });
  if (!row)
    throw new Error(
      `No ${currencyCode} exchange rate on or before ${day}. Add one in Settings → Exchange rates.`,
    );
  return new Decimal(row.rate);
}

/** Base units per 1 unit of the project's currency on `date`. */
export async function resolveProjectRate(
  tx: Db,
  organizationId: string,
  projectId: string,
  date: Date | string,
) {
  const project = await tx.project.findFirstOrThrow({
    where: { id: projectId, organizationId },
    select: { currency: true },
  });
  return resolveRate(tx, organizationId, project.currency, date);
}

/**
 * Rate and base-conversion helper for a financial document. `override` is a
 * user-entered rate; it is ignored for the base currency (always exactly 1).
 */
export async function resolveDocumentFx(
  tx: Db,
  input: {
    organizationId: string;
    currency: string;
    date: Date | string;
    override?: Numeric | null;
  },
) {
  const base = await organizationBaseCurrency(tx, input.organizationId);
  const exchangeRate =
    input.currency === base.code
      ? new Decimal(1)
      : input.override !== undefined && input.override !== null
        ? assertPositiveRate(input.override)
        : await resolveRate(
            tx,
            input.organizationId,
            input.currency,
            input.date,
          );
  return {
    exchangeRate,
    baseCurrency: base.code,
    baseDecimals: base.decimals,
    toBase: (amount: Numeric) => toBase(amount, exchangeRate, base.decimals),
  };
}
