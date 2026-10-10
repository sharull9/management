import { Prisma } from "@/generated/prisma/browser";
import type { Prisma as ServerPrisma } from "@/generated/prisma/client";
export type Numeric = string | ServerPrisma.Decimal;
export const Decimal = Prisma.Decimal.clone({ precision: 48 });
export const money = (value: Numeric) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
