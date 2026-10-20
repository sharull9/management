import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInAllocation,
  assertMeterOrder,
  assertNoIntervalOverlap,
} from "./log-rules";

test("allocation boundaries include both calendar dates", () => {
  const start = new Date("2026-04-01T00:00:00.000Z");
  const end = new Date("2026-04-03T00:00:00.000Z");
  assert.doesNotThrow(() =>
    assertInAllocation(new Date("2026-04-01T18:00:00Z"), start, end),
  );
  assert.doesNotThrow(() =>
    assertInAllocation(new Date("2026-04-03T00:00:00Z"), start, end),
  );
  assert.throws(
    () => assertInAllocation(new Date("2026-04-04T00:00:00Z"), start, end),
    /outside the allocation/,
  );
});

test("meter readings stay monotonic in chronological order", () => {
  assert.doesNotThrow(() =>
    assertMeterOrder([
      { at: new Date("2026-04-02T10:00:00Z"), value: "12", id: "b" },
      { at: new Date("2026-04-01T10:00:00Z"), value: "10", id: "a" },
    ]),
  );
  assert.throws(
    () =>
      assertMeterOrder([
        { at: new Date("2026-04-01T10:00:00Z"), value: "13", id: "a" },
        { at: new Date("2026-04-02T10:00:00Z"), value: "12", id: "b" },
      ]),
    /Meter reading conflicts/,
  );
  assert.doesNotThrow(() =>
    assertMeterOrder([
      {
        at: new Date("2026-04-02T00:00:00Z"),
        value: "13",
        id: "fuel",
        dayGranularity: true,
      },
      { at: new Date("2026-04-02T10:00:00Z"), value: "12", id: "trip:start" },
    ]),
  );
});

test("fuel date granularity cannot mask a timed regression across dates", () => {
  assert.throws(
    () =>
      assertMeterOrder([
        { at: new Date("2026-04-01T10:00:00Z"), value: "20", id: "trip:end" },
        {
          at: new Date("2026-04-02T00:00:00Z"),
          value: "25",
          id: "fuel",
          dayGranularity: true,
        },
        { at: new Date("2026-04-03T10:00:00Z"), value: "19", id: "trip:start" },
      ]),
    /Meter reading conflicts/,
  );
});

test("date-only fills are bounded by adjacent days and allow normal same-day fills", () => {
  assert.doesNotThrow(() =>
    assertMeterOrder([
      {
        at: new Date("2026-04-01T00:00:00Z"),
        value: "10",
        id: "before",
        dayGranularity: true,
      },
      {
        at: new Date("2026-04-02T00:00:00Z"),
        value: "12",
        id: "fill-a",
        dayGranularity: true,
      },
      {
        at: new Date("2026-04-02T00:00:00Z"),
        value: "13",
        id: "fill-b",
        dayGranularity: true,
      },
      { at: new Date("2026-04-02T14:00:00Z"), value: "12", id: "trip:start" },
      { at: new Date("2026-04-02T15:00:00Z"), value: "14", id: "trip:end" },
      {
        at: new Date("2026-04-03T00:00:00Z"),
        value: "15",
        id: "after",
        dayGranularity: true,
      },
    ]),
  );
  assert.throws(
    () =>
      assertMeterOrder([
        {
          at: new Date("2026-04-01T00:00:00Z"),
          value: "20",
          id: "before",
          dayGranularity: true,
        },
        {
          at: new Date("2026-04-02T00:00:00Z"),
          value: "19",
          id: "fill",
          dayGranularity: true,
        },
      ]),
    /Meter reading conflicts/,
  );
});

test("contiguous timed intervals allow an equal meter reading at their shared instant", () => {
  assert.doesNotThrow(() =>
    assertMeterOrder([
      { at: new Date("2026-04-01T10:00:00Z"), value: "10", id: "first:start" },
      { at: new Date("2026-04-01T11:00:00Z"), value: "15", id: "first:end" },
      { at: new Date("2026-04-01T11:00:00Z"), value: "15", id: "second:start" },
      { at: new Date("2026-04-01T12:00:00Z"), value: "18", id: "second:end" },
    ]),
  );
});

test("trip and usage intervals may touch but cannot overlap", () => {
  const start = new Date("2026-04-01T10:00:00Z");
  const middle = new Date("2026-04-01T11:00:00Z");
  const end = new Date("2026-04-01T12:00:00Z");
  assert.doesNotThrow(() =>
    assertNoIntervalOverlap(middle, end, [{ start, end: middle }]),
  );
  assert.throws(
    () =>
      assertNoIntervalOverlap(new Date("2026-04-01T10:30:00Z"), end, [
        { start, end: middle },
      ]),
    /cannot overlap/,
  );
});
