import { Prisma } from "../../generated/prisma/browser";

export const Decimal = Prisma.Decimal.clone({ precision: 48 });
export type Money = string | InstanceType<typeof Prisma.Decimal>;
export const REQUIRE_REQUEST_FOR_MODES: readonly string[] = ["CASH"];
export const settledStatuses = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;
export function amount(value: Money) {
  const n = new Decimal(value);
  if (!n.isFinite() || n.lt(0) || !n.eq(n.toDecimalPlaces(2)))
    throw new Error(
      "Money must be nonnegative with at most two decimal places.",
    );
  return n;
}
export function validateAllocation(
  available: Money,
  outstanding: Money,
  value: Money,
) {
  const n = amount(value);
  if (n.lte(0)) throw new Error("Allocation must be positive.");
  if (n.gt(amount(available)))
    throw new Error("Allocation exceeds payment's unallocated amount.");
  if (n.gt(amount(outstanding)))
    throw new Error("Allocation exceeds document outstanding.");
  return n;
}
export function settlementStatus(
  total: Money,
  paid: Money,
): "APPROVED" | "PARTIALLY_PAID" | "PAID" {
  const t = amount(total),
    p = amount(paid);
  if (p.gt(t)) throw new Error("Settlement exceeds payable total.");
  return p.eq(t) ? "PAID" : p.isZero() ? "APPROVED" : "PARTIALLY_PAID";
}
export function agingBucket(
  due: Date | null,
  asOf: Date,
): "current" | "0–30" | "31–60" | "61–90" | "90+" {
  if (!due) return "current";
  const day = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.floor((day(asOf) - day(due)) / 86400000);
  return days < 0
    ? "current"
    : days <= 30
      ? "0–30"
      : days <= 60
        ? "31–60"
        : days <= 90
          ? "61–90"
          : "90+";
}
export type StatementEntry = {
  id: string;
  date: Date;
  description: string;
  debit: Money;
  credit: Money;
  order?: number;
};
export function runningBalance(entries: StatementEntry[]) {
  let balance = new Decimal(0);
  return [...entries]
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .map((e) => {
      balance = balance.add(amount(e.debit)).sub(amount(e.credit));
      return { ...e, balance: balance.toFixed(2) };
    });
}
