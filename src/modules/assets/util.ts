import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type {
  AssetMeterType,
  AssetPowerType,
  AssetType,
  FuelEfficiency,
} from "./type";

export function assertAssetConfiguration(input: {
  type: AssetType;
  meterType: AssetMeterType;
  powerType: AssetPowerType;
  powerRatingKw?: Numeric | null;
  electricityTariff?: Numeric | null;
}) {
  const electric = input.powerType === "ELECTRIC";
  if (electric) {
    const power =
      input.powerRatingKw == null ? null : new Decimal(input.powerRatingKw);
    if (power == null || !power.isFinite() || !power.gt(0))
      throw new UserFacingError("Electric assets need a positive kW rating.");
    if (
      input.electricityTariff == null ||
      !new Decimal(input.electricityTariff).isFinite() ||
      new Decimal(input.electricityTariff).lt(0)
    )
      throw new UserFacingError(
        "Electric assets need a non-negative electricity tariff.",
      );
  } else if (input.powerRatingKw != null || input.electricityTariff != null) {
    throw new UserFacingError(
      "Only electric assets may have a kW rating or electricity tariff.",
    );
  }
}

export function assertDateRange(start: Date, end?: Date | null) {
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime())))
    throw new UserFacingError("Enter valid dates.");
  if (end && end < start)
    throw new UserFacingError("End date must be on or after start date.");
}

export function assertUsageInterval(input: {
  startAt: Date;
  endAt: Date;
  startReading: Numeric;
  endReading: Numeric;
}) {
  assertDateRange(input.startAt, input.endAt);
  if (input.endAt.getTime() === input.startAt.getTime())
    throw new UserFacingError("Usage duration must be greater than zero.");
  assertNonNegativeReadings(input.startReading, input.endReading);
}

export function assertNonNegativeReadings(start: Numeric, end: Numeric) {
  const startValue = new Decimal(start);
  const endValue = new Decimal(end);
  if (
    !startValue.isFinite() ||
    !endValue.isFinite() ||
    startValue.lt(0) ||
    endValue.lt(0)
  )
    throw new UserFacingError("Meter readings must be non-negative numbers.");
  if (endValue.lt(startValue))
    throw new UserFacingError("End reading must be on or after start reading.");
}

export function calculateFuelEfficiency(input: {
  meterType: AssetMeterType;
  previousReading: Numeric | null;
  currentReading: Numeric;
  quantityLitres: Numeric;
}): FuelEfficiency {
  const quantity = new Decimal(input.quantityLitres);
  const current = new Decimal(input.currentReading);
  if (!quantity.isFinite() || !quantity.gt(0))
    throw new UserFacingError("Fuel quantity must be greater than zero.");
  if (!current.isFinite() || current.lt(0))
    throw new UserFacingError("Meter reading must be non-negative.");
  if (input.previousReading == null)
    return {
      value: null,
      unit: input.meterType === "KM" ? "km/L" : "L/hr",
      label: "estimate",
    };
  const previous = new Decimal(input.previousReading);
  if (!previous.isFinite() || previous.lt(0))
    throw new UserFacingError("Previous meter reading must be non-negative.");
  const delta = current.sub(previous);
  if (delta.lt(0))
    throw new UserFacingError(
      "Current reading must be on or after the previous reading.",
    );
  const rate = delta.isZero()
    ? null
    : input.meterType === "KM"
      ? delta.div(quantity)
      : quantity.div(delta);
  return {
    value: rate?.toDecimalPlaces(4, Decimal.ROUND_HALF_UP) ?? null,
    unit: input.meterType === "KM" ? "km/L" : "L/hr",
    label: "estimate",
  };
}

export function calculateElectricity(input: {
  hours: Numeric;
  powerRatingKw: Numeric;
  tariff: Numeric;
  decimals?: number;
}) {
  const hours = new Decimal(input.hours);
  const kw = new Decimal(input.powerRatingKw);
  const tariff = new Decimal(input.tariff);
  if (!hours.isFinite() || !hours.gt(0))
    throw new UserFacingError("Usage duration must be greater than zero.");
  if (!kw.isFinite() || !kw.gt(0))
    throw new UserFacingError("Power rating must be greater than zero.");
  if (!tariff.isFinite() || tariff.lt(0))
    throw new UserFacingError("Electricity tariff must be non-negative.");
  const kwh = hours.mul(kw).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return {
    kwh,
    cost: hours
      .mul(kw)
      .mul(tariff)
      .toDecimalPlaces(input.decimals ?? 2, Decimal.ROUND_HALF_UP),
  };
}

export function calculateEquipmentCost(
  quantity: Numeric,
  ratePerMeter: Numeric,
  decimals = 2,
) {
  const amount = new Decimal(quantity);
  const rate = new Decimal(ratePerMeter);
  if (!amount.isFinite() || amount.lt(0))
    throw new UserFacingError("Usage quantity must be non-negative.");
  if (!rate.isFinite() || rate.lt(0))
    throw new UserFacingError("Equipment rate must be non-negative.");
  return amount.mul(rate).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}
