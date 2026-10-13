import { z } from "zod";
import { Decimal } from "@/core/decimal";
import { date, id } from "@/core/schema";

export const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a three-letter ISO currency code.");

export const tenantCurrencyInput = z.object({
  currencyCode,
  enabled: z.boolean(),
});

export const addCurrencyInput = z.object({ currencyCode });

export const baseCurrencyInput = z.object({ currencyCode });

const rate = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(?:\.\d{1,10})?$/,
    "Enter a rate with up to 10 decimal places.",
  )
  .refine((value) => {
    // Zod keeps running checks after the regex fails, so the text may not parse.
    try {
      return new Decimal(value).gt(0);
    } catch {
      return false;
    }
  }, "Rate must be greater than zero.");

export const exchangeRateInput = z.object({
  id: id.nullable().optional(),
  currencyCode,
  rateDate: date,
  rate,
});

export const deleteExchangeRateInput = z.object({ id });

export const exchangeRatePreviewInput = z.object({
  currency: currencyCode,
  date: z.iso.date(),
});
