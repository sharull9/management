import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";

export function assertInAllocation(date: Date, start: Date, end?: Date | null) {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (day < start || (end && day > end))
    throw new UserFacingError("Log date is outside the allocation range.");
}

export function assertNoIntervalOverlap(
  startAt: Date,
  endAt: Date,
  intervals: { start: Date; end: Date }[],
) {
  if (
    intervals.some(
      (interval) => startAt < interval.end && endAt > interval.start,
    )
  )
    throw new UserFacingError("Trip and usage intervals cannot overlap.");
}

export function assertMeterOrder(
  points: { at: Date; value: Numeric; id: string; dayGranularity?: boolean }[],
) {
  const timed = points
    .filter((point) => !point.dayGranularity)
    .sort(
      (a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id),
    );
  for (let i = 1; i < timed.length; i++) {
    const previous = timed[i - 1];
    const current = timed[i];
    if (
      previous &&
      current &&
      (new Decimal(current.value).lt(previous.value) ||
        (current.at.getTime() === previous.at.getTime() &&
          !new Decimal(current.value).eq(previous.value)))
    )
      throw new UserFacingError(
        "Meter reading conflicts with a neighboring asset log.",
      );
  }

  const day = (point: (typeof points)[number]) =>
    point.at.toISOString().slice(0, 10);
  const days = new Map<string, (typeof points)[number][]>();
  for (const point of points)
    days.set(day(point), [...(days.get(day(point)) ?? []), point]);
  const dated = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (let i = 0; i < dated.length; i++) {
    const currentDay = dated[i];
    if (!currentDay) continue;
    const [, entries] = currentDay;
    const fills = entries
      .filter((entry) => entry.dayGranularity)
      .sort(
        (a, b) =>
          new Decimal(a.value).comparedTo(b.value) || a.id.localeCompare(b.id),
      );
    for (const fill of fills) {
      const previousDay = dated
        .slice(0, i)
        .reverse()
        .find(([, rows]) => rows.length)?.[1];
      const nextDay = dated.slice(i + 1).find(([, rows]) => rows.length)?.[1];
      const previousMaximum = previousDay?.reduce<InstanceType<
        typeof Decimal
      > | null>(
        (max, point) =>
          max === null || new Decimal(point.value).gt(max)
            ? new Decimal(point.value)
            : max,
        null,
      );
      const nextMinimum = nextDay?.reduce<InstanceType<typeof Decimal> | null>(
        (min, point) =>
          min === null || new Decimal(point.value).lt(min)
            ? new Decimal(point.value)
            : min,
        null,
      );
      if (
        (previousMaximum && new Decimal(fill.value).lt(previousMaximum)) ||
        (nextMinimum && new Decimal(fill.value).gt(nextMinimum))
      )
        throw new UserFacingError(
          "Meter reading conflicts with a neighboring asset log.",
        );
    }
    for (let j = 1; j < fills.length; j++) {
      const previous = fills[j - 1];
      const current = fills[j];
      if (previous && current && new Decimal(current.value).lt(previous.value))
        throw new UserFacingError(
          "Meter reading conflicts with a neighboring asset log.",
        );
    }
  }
}
