/** Server-safe helpers for comma-separated multi-select URL params. */

/** Parses `a,b,c` into `["a","b","c"]`; empty/absent gives `[]`. */
export function parseMultiParam(value?: string | string[] | null): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return [
    ...new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function serializeMultiParam(values: string[]): string | null {
  return values.length ? values.join(",") : null;
}
