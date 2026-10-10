import { z } from "zod";
import { Prisma } from "@/generated/prisma/browser";
import { CostType } from "@/generated/prisma/enums";
export const id = z.string().min(1).max(100);
export const text = z.string().trim().max(5000);
export const money = z
  .string()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    "Enter a nonnegative amount with up to two decimal places.",
  );
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
export const materialCostRecognitionInput = z.enum([
  "ON_RECEIPT",
  "ON_CONSUMPTION",
]);
export const expenseInput = z.object({
  stageId: id.nullable(),
  taskId: id.nullable(),
  partyId: id.nullable(),
  costType: z.enum(CostType),
  amount: money.refine((v) => new Prisma.Decimal(v).gt(0)),
  description: text.min(1),
});
