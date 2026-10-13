import { z } from "zod";
import { Decimal } from "@/core/decimal";
import { amount } from "./server/allocation";

export const id = z.string().trim().min(1).max(100);
const optionalId = id.nullable();
export const moneyInput = z
  .string()
  .regex(
    /^\d{1,16}(\.\d{1,2})?$/,
    "Enter money with at most two decimal places.",
  )
  .pipe(z.string().refine((v) => amount(v).gt(0), "Amount must be positive."));
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Select a currency.");
/** Blank means "resolve from the dated rate table"; the base currency is always 1. */
export const exchangeRateInput = z.union([
  z
    .string()
    .trim()
    .regex(
      /^\d{1,10}(?:\.\d{1,10})?$/,
      "Enter a rate with up to 10 decimal places.",
    )
    .pipe(
      z
        .string()
        .refine((v) => new Decimal(v).gt(0), "Rate must be greater than zero."),
    ),
  z.literal("").transform(() => null),
  z.null(),
]);
/** Omitted currency means the organization's base currency. */
export const currencyFields = {
  currency: currencyCode.nullish(),
  exchangeRate: exchangeRateInput.optional(),
};
const date = z.iso.date().transform((v) => new Date(`${v}T00:00:00.000Z`));
export const allocationsInput = z
  .array(z.object({ documentId: id, amount: moneyInput }))
  .max(100)
  .refine(
    (rows) => new Set(rows.map((r) => r.documentId)).size === rows.length,
    "Select each document once.",
  );
const common = {
  partyId: id,
  projectId: optionalId,
  date,
  mode: z.enum(["CASH", "BANK", "UPI", "CHEQUE", "OTHER"]),
  amount: moneyInput,
  ...currencyFields,
};
export const requestInput = z.object({
  ...common,
  id: optionalId,
  purpose: z.enum(["ADVANCE", "BILL_SETTLEMENT", "OTHER"]),
  reason: z.string().trim().min(1).max(2000),
  allocations: allocationsInput,
});
export const paymentInput = z.object({
  ...common,
  direction: z.enum(["OUTGOING", "INCOMING"]),
  paymentRequestId: optionalId,
  reference: z.string().trim().max(200),
  notes: z.string().trim().max(2000),
});

export const submitRequestInput = z.object({ id });
export const allocationActionInput = z.object({
  id,
  allocations: allocationsInput.min(1),
});
export const voidPaymentInput = z.object({
  id,
  reason: z.string().trim().min(1).max(1000),
});
