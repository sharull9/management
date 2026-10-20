import { Decimal } from "@/core/decimal";

export function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

export function sumDecimalStrings(values: string[]) {
  return values.reduce((sum, value) => sum.plus(value || "0"), new Decimal(0));
}

export function formatDecimalString(value: InstanceType<typeof Decimal>) {
  return value.toFixed(2);
}
