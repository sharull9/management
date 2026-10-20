import assert from "node:assert/strict";
import test from "node:test";
import { fuelEfficiencyById, fuelEfficiencyEstimate } from "./fuel-efficiency";

const log = (id: string, date: string, reading: string, litres = "10") => ({
  id,
  date: new Date(`${date}T00:00:00Z`),
  meterReading: reading,
  quantityLitres: litres,
});

test("estimates use the complete asset history, including another project", () => {
  const fullHistory = [
    log("visible", "2026-04-02", "220"),
    log("hidden", "2026-04-01", "120"),
  ];
  assert.equal(
    fuelEfficiencyById("KM", fullHistory).get("visible"),
    "10 km/L estimate",
  );
  assert.equal(fuelEfficiencyById("KM", [fullHistory[0]]).get("visible"), null);
});

test("edits and deletes recompute estimates for following fills", () => {
  assert.equal(
    fuelEfficiencyById("KM", [
      log("a", "2026-04-01", "100"),
      log("b", "2026-04-02", "200"),
    ]).get("b"),
    "10 km/L estimate",
  );
  assert.equal(
    fuelEfficiencyById("KM", [
      log("a", "2026-04-01", "150"),
      log("b", "2026-04-02", "200"),
    ]).get("b"),
    "5 km/L estimate",
  );
  assert.equal(
    fuelEfficiencyById("KM", [log("b", "2026-04-02", "200")]).get("b"),
    null,
  );
});

test("same-day ordering uses numeric reading and then id", () => {
  const estimates = fuelEfficiencyById("HOURS", [
    log("b", "2026-04-01", "30"),
    log("a", "2026-04-01", "20"),
  ]);
  assert.equal(estimates.get("a"), null);
  assert.equal(estimates.get("b"), "1 L/hr estimate");
});

test("a visible fill can use only its hidden-project predecessor reading", () => {
  const visible = log("visible", "2026-04-02", "220");
  assert.equal(
    fuelEfficiencyEstimate("KM", "120", visible),
    "10 km/L estimate",
  );
  assert.equal(fuelEfficiencyEstimate("KM", null, visible), null);
});
