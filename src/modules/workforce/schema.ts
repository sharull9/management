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
  (v) => new Prisma.Decimal(v).gt(0),
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
