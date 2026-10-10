import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAvailability, rangesOverlap } from "./availability";

const range = (start: string, end: string | null) => ({
  startDate: new Date(start),
  endDate: end ? new Date(end) : null,
});
test("inclusive ranges overlap on boundary and open ends", () => {
  assert.equal(
    rangesOverlap(range("2026-01-01", "2026-01-10"), range("2026-01-10", null)),
    true,
  );
  assert.equal(
    rangesOverlap(range("2026-01-01", "2026-01-09"), range("2026-01-10", null)),
    false,
  );
});
test("confirmation allows overlap but never an inactive worker or reversed range", () => {
  const assignment = range("2026-01-01", null);
  assert.throws(() => checkAvailability(true, assignment, [assignment]));
  assert.equal(
    checkAvailability(true, assignment, [assignment], true).length,
    1,
  );
  assert.throws(() => checkAvailability(false, assignment, [], true));
  assert.throws(() =>
    checkAvailability(true, range("2026-02-01", "2026-01-01"), [], true),
  );
});
