import type { Prisma } from "@/generated/prisma/client";

type Serialised<T> = T extends Date | Prisma.Decimal
  ? string
  : T extends readonly (infer U)[]
    ? Serialised<U>[]
    : T extends object
      ? { [K in keyof T]: Serialised<T[K]> }
      : T;
// Prisma Decimal and Date implement toJSON; exclude request context before calling.
export function serialiseMasterData<T>(data: T): Serialised<T> {
  return JSON.parse(JSON.stringify(data)) as Serialised<T>;
}
