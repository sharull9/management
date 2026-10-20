import { createHash } from "node:crypto";
import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";

export function utcDay(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new UserFacingError("Journal date is invalid.");
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function canonicalAmount(value: Numeric | null | undefined) {
  if (value == null) return null;
  const amount = new Decimal(value);
  if (!amount.isFinite())
    throw new UserFacingError("Journal amounts must be finite.");
  return amount.toFixed();
}

export function sourceFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
