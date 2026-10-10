import { Prisma } from "@/generated/prisma/browser";
import type { Prisma as ServerPrisma } from "@/generated/prisma/client";

type Money = string | ServerPrisma.Decimal;
const Decimal = Prisma.Decimal.clone({ precision: 48 });
export type PayTerms = {
  payType: "MONTHLY" | "DAILY" | "HOURLY";
  salaryAmount: Money;
  costDaysPerMonth: Money;
  standardHoursPerDay: Money;
  overtimeMultiplier: Money;
  dayRateOverride?: Money | null;
  otHourlyRateOverride?: Money | null;
};
export function attendanceCost(
  terms: PayTerms,
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE",
  overtimeHours: Money,
) {
  const salary = new Decimal(terms.salaryAmount);
  const hours = new Decimal(terms.standardHoursPerDay);
  const days = new Decimal(terms.costDaysPerMonth);
  const ot = new Decimal(overtimeHours);
  const multiplier = new Decimal(terms.overtimeMultiplier);
  if (
    [hours, days, salary, ot, multiplier].some((v) => !v.isFinite()) ||
    hours.lte(0) ||
    days.lte(0) ||
    salary.lt(0) ||
    ot.lt(0) ||
    multiplier.lt(0)
  )
    throw new Error("Pay terms and hours are invalid.");
  const dayRate =
    terms.dayRateOverride != null
      ? new Decimal(terms.dayRateOverride)
      : terms.payType === "MONTHLY"
        ? salary.div(days)
        : terms.payType === "HOURLY"
          ? salary.mul(hours)
          : salary;
  const otRate =
    terms.otHourlyRateOverride != null
      ? new Decimal(terms.otHourlyRateOverride)
      : terms.dayRateOverride == null && terms.payType === "MONTHLY"
        ? salary.mul(terms.overtimeMultiplier).div(days.mul(hours))
        : dayRate.mul(terms.overtimeMultiplier).div(hours);
  if (
    !dayRate.isFinite() ||
    !otRate.isFinite() ||
    dayRate.lt(0) ||
    otRate.lt(0)
  )
    throw new Error("Rates cannot be negative.");
  const factor =
    status === "PRESENT" ? "1" : status === "HALF_DAY" ? "0.5" : "0";
  const dayCost = dayRate
    .mul(factor)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const otCost = ot
    .mul(otRate)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { dayRate, otRate, dayCost, otCost, totalCost: dayCost.add(otCost) };
}
