const pattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` as a local calendar date, avoiding UTC day shifts. */
export function fromDateValue(value?: string | null) {
  const match = value ? pattern.exec(value) : null;
  if (!match) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formats a local calendar date as `YYYY-MM-DD`. */
export function toDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
