export type DateRange = { startDate: Date; endDate: Date | null };
export function rangesOverlap(a: DateRange, b: DateRange) {
  return (
    (!a.endDate || b.startDate <= a.endDate) &&
    (!b.endDate || a.startDate <= b.endDate)
  );
}
export function checkAvailability(
  active: boolean,
  range: DateRange,
  assignments: DateRange[],
  confirmed = false,
) {
  if (!active) throw new Error("Inactive workers cannot be assigned.");
  if (range.endDate && range.endDate < range.startDate)
    throw new Error("End date must be on or after start date.");
  const overlaps = assignments.filter((assignment) =>
    rangesOverlap(range, assignment),
  );
  if (overlaps.length && !confirmed)
    throw new Error(
      "This worker has overlapping project assignments. Confirm the overlap to continue.",
    );
  return overlaps;
}
