import { z } from "zod";
import { Prisma } from "@/generated/prisma/browser";
import { PayType } from "@/generated/prisma/enums";
export const id = z.string().min(1).max(100);
export const name = z.string().trim().min(1).max(150);
export const money = z
  .string()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    "Enter a nonnegative amount with up to two decimal places.",
  );
export const rate = z
  .string()
  .regex(
    /^\d{1,14}(?:\.\d{1,4})?$/,
    "Enter a nonnegative rate with up to four decimal places.",
  );
export const positiveRate = rate.refine(
  (v) => /^\d{1,14}(?:\.\d{1,4})?$/.test(v) && new Prisma.Decimal(v).gt(0),
  "Days and hours must be positive.",
);
export const workerInput = z.object({
  name,
  phone: z.string().max(40).nullable(),
  designationId: id.nullable(),
  payType: z.enum(PayType),
  salaryAmount: money,
  costDaysPerMonth: positiveRate,
  standardHoursPerDay: positiveRate,
  overtimeMultiplier: rate,
});

export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date.",
  )
  .transform((v) => new Date(`${v}T00:00:00Z`));

const nullableDateInput = z
  .union([date, z.literal(""), z.null()])
  .transform((v) => (v === "" ? null : v));

export const saveWorkerInput = workerInput.extend({
  id: id.nullable(),
  joinDate: nullableDateInput,
  active: z.boolean(),
  phone: z
    .string()
    .max(40)
    .nullable()
    .transform((v) => v?.trim() || null),
});
export const designationInput = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("SAVE"), id: id.nullable(), name }),
  z.object({ operation: z.literal("DELETE"), id }),
]);
export const workforceFiltersInput = z
  .object({
    search: z.string().max(150),
    workerId: id.nullable(),
    from: date,
    to: date,
  })
  .refine((v) => v.to >= v.from, {
    path: ["to"],
    message: "End date must be on or after start date.",
  });
