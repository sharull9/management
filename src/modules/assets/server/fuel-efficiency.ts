import { Decimal } from "@/core/decimal";
import type { AssetMeterType } from "../type";
import { calculateFuelEfficiency } from "../util";

type FuelReading = {
  id: string;
  date: Date;
  meterReading: { toString(): string } | string;
  quantityLitres: { toString(): string } | string;
};

export function fuelEfficiencyById(
  meterType: AssetMeterType,
  logs: FuelReading[],
) {
  const ordered = [...logs].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      new Decimal(a.meterReading.toString()).comparedTo(
        b.meterReading.toString(),
      ) ||
      a.id.localeCompare(b.id),
  );
  const estimates = new Map<string, string | null>();
  let previous: string | null = null;
  for (const log of ordered) {
    const result = calculateFuelEfficiency({
      meterType,
      previousReading: previous,
      currentReading: log.meterReading.toString(),
      quantityLitres: log.quantityLitres.toString(),
    });
    estimates.set(
      log.id,
      result.value === null
        ? null
        : `${result.value.toString()} ${result.unit} estimate`,
    );
    previous = log.meterReading.toString();
  }
  return estimates;
}

export function fuelEfficiencyEstimate(
  meterType: AssetMeterType,
  previousReading: string | null,
  log: FuelReading,
) {
  const result = calculateFuelEfficiency({
    meterType,
    previousReading,
    currentReading: log.meterReading.toString(),
    quantityLitres: log.quantityLitres.toString(),
  });
  return result.value === null
    ? null
    : `${result.value.toString()} ${result.unit} estimate`;
}
