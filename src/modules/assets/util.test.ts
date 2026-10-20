import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssetConfiguration,
  assertDateRange,
  assertUsageInterval,
  calculateElectricity,
  calculateEquipmentCost,
  calculateFuelEfficiency,
} from "./util";

test("equipment and electricity costs use Decimal arithmetic and stored precision", () => {
  assert.equal(calculateEquipmentCost("1.25", "10.10").toString(), "12.63");
  const result = calculateElectricity({
    hours: "1.5",
    powerRatingKw: "2.25",
    tariff: "8.40",
  });
  assert.equal(result.kwh.toString(), "3.375");
  assert.equal(result.cost.toString(), "28.35");
});

test("asset costs round once at the base currency precision", () => {
  assert.equal(calculateEquipmentCost("0.4999", "1", 0).toString(), "0");
  const electricity = calculateElectricity({
    hours: "0.000049",
    powerRatingKw: "1",
    tariff: "1000",
  });
  assert.equal(electricity.kwh.toString(), "0");
  assert.equal(electricity.cost.toString(), "0.05");
  assert.equal(
    calculateElectricity({
      hours: "0.4999",
      powerRatingKw: "1",
      tariff: "1",
      decimals: 0,
    }).cost.toString(),
    "0",
  );
});

test("date and usage intervals reject invalid order and zero duration", () => {
  assert.throws(
    () => assertDateRange(new Date("2026-02-02"), new Date("2026-02-01")),
    /on or after/,
  );
  assert.throws(
    () =>
      assertUsageInterval({
        startAt: new Date("2026-02-01T10:00:00Z"),
        endAt: new Date("2026-02-01T10:00:00Z"),
        startReading: "0",
        endReading: "0",
      }),
    /duration/,
  );
});

test("fuel efficiency uses current fill quantity and returns an estimate", () => {
  const km = calculateFuelEfficiency({
    meterType: "KM",
    previousReading: "100",
    currentReading: "350",
    quantityLitres: "25",
  });
  assert.equal(km.value?.toString(), "10");
  assert.equal(km.unit, "km/L");
  assert.equal(km.label, "estimate");
  assert.equal(
    calculateFuelEfficiency({
      meterType: "HOURS",
      previousReading: "10",
      currentReading: "15",
      quantityLitres: "20",
    }).value?.toString(),
    "4",
  );
  assert.equal(
    calculateFuelEfficiency({
      meterType: "KM",
      previousReading: "25",
      currentReading: "25",
      quantityLitres: "10",
    }).value,
    null,
  );
  assert.equal(
    calculateFuelEfficiency({
      meterType: "KM",
      previousReading: null,
      currentReading: "25",
      quantityLitres: "10",
    }).value,
    null,
  );
});

test("electric power is independent of asset type and meter", () => {
  assert.doesNotThrow(() =>
    assertAssetConfiguration({
      type: "VEHICLE",
      meterType: "KM",
      powerType: "ELECTRIC",
      powerRatingKw: "20",
      electricityTariff: "5",
    }),
  );
  assert.throws(
    () =>
      assertAssetConfiguration({
        type: "MACHINE",
        meterType: "HOURS",
        powerType: "ELECTRIC",
      }),
    /positive kW/,
  );
  assert.throws(
    () =>
      assertAssetConfiguration({
        type: "MACHINE",
        meterType: "HOURS",
        powerType: "ELECTRIC",
        powerRatingKw: "20",
        electricityTariff: "-0.01",
      }),
    /non-negative electricity tariff/,
  );
  assert.throws(
    () =>
      assertAssetConfiguration({
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        powerRatingKw: "20",
        electricityTariff: "5",
      }),
    /Only electric assets/,
  );
  assert.doesNotThrow(() =>
    assertAssetConfiguration({
      type: "MACHINE",
      meterType: "HOURS",
      powerType: "ELECTRIC",
      powerRatingKw: "20",
      electricityTariff: "5",
    }),
  );
});
