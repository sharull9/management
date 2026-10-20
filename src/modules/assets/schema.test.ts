import assert from "node:assert/strict";
import test from "node:test";
import {
  assetAllocationInput,
  assetFuelLogInput,
  assetTripInput,
  assetUsageInput,
} from "./schema";

const identity = {
  assetId: "asset",
  allocationId: "allocation",
  projectId: "project",
};

test("asset log intervals compare instants across timezone offsets", () => {
  const readings = { ...identity, startReading: "0", endReading: "1" };
  assert.equal(
    assetTripInput.safeParse({
      ...readings,
      outAt: "2026-10-18T06:00:00Z",
      inAt: "2026-10-18T06:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    assetTripInput.safeParse({
      ...readings,
      outAt: "2026-10-18T10:00:00+05:30",
      inAt: "2026-10-18T06:00:00Z",
    }).success,
    true,
  );
  assert.equal(
    assetTripInput.safeParse({
      ...readings,
      outAt: "2026-10-18T06:00:00Z",
      inAt: "2026-10-18T10:00:00+05:30",
    }).success,
    false,
  );
  assert.equal(
    assetUsageInput.safeParse({
      ...readings,
      startAt: "2026-10-18T10:00:00+05:30",
      endAt: "2026-10-18T04:30:00Z",
    }).success,
    false,
  );
});

test("asset dates reject malformed input through schema validation", () => {
  for (const value of ["2026-02-30", "2026-99-99", "invalid"]) {
    assert.equal(
      assetAllocationInput.safeParse({
        assetId: "asset",
        projectId: "project",
        startDate: value,
      }).success,
      false,
    );
    assert.equal(
      assetFuelLogInput.safeParse({
        ...identity,
        date: value,
        quantityLitres: "1",
        totalCost: "0",
        meterReading: "0",
      }).success,
      false,
    );
  }
});

test("fuel input preserves decimal strings and rejects zero or excess precision", () => {
  const fuel = {
    ...identity,
    date: "2026-10-18",
    quantityLitres: "1.2345",
    totalCost: "12.50",
    meterReading: "100.1234",
  };
  assert.equal(assetFuelLogInput.parse(fuel).quantityLitres, "1.2345");
  assert.equal(
    assetFuelLogInput.safeParse({ ...fuel, quantityLitres: "0" }).success,
    false,
  );
  assert.equal(
    assetFuelLogInput.safeParse({ ...fuel, totalCost: "12.501" }).success,
    false,
  );
});
