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
export const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Choose a currency.");
/** Base units per 1 unit of the expense currency; null resolves the dated rate. */
export const exchangeRateInput = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,10})?$/, "Enter a rate with up to 10 decimals.")
  .refine((v) => Number(v) > 0, "Exchange rate must be greater than zero.");
export const expenseInput = z.object({
  currency: currencyCode,
  exchangeRate: exchangeRateInput
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  stageId: id.nullable(),
  taskId: id.nullable(),
  partyId: id.nullable(),
  costType: z.enum(CostType),
  amount: money.refine(
    (v) => /^\d{1,16}(?:\.\d{1,2})?$/.test(v) && new Prisma.Decimal(v).gt(0),
  ),
  description: text.min(1),
});

export const costRecognitionInput = z.object({
  materialCostRecognition: materialCostRecognitionInput,
  confirmCostRecognitionChange: z.boolean(),
});
export const createExpenseInput = expenseInput.extend({ date });
export const costFiltersInput = z.object({
  costType: z.enum(CostType).nullable(),
  stageId: id.nullable(),
  from: z.union([date, z.literal("")]),
  to: z.union([date, z.literal("")]),
});
