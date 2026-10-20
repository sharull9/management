import { z } from "zod";
import { id } from "@/core/schema";

const accountType = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
]);
const date = z.iso.date();
const decimalString = z
  .string()
  .trim()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    "Enter a non-negative amount with up to two decimal places.",
  );
const accountFields = {
  id: id.optional(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  type: accountType,
  active: z.boolean(),
};

export const accountInput = z.object(accountFields);
export const templateInput = z.object(accountFields);
export const journalInput = z.object({
  id: id.optional(),
  date,
  description: z.string().trim().min(1).max(500),
  lines: z
    .array(
      z.object({
        accountId: id,
        description: z.string().max(500),
        debit: decimalString,
        credit: decimalString,
        projectId: id.nullable(),
        partyId: id.nullable(),
      }),
    )
    .min(2),
});
export const journalIdInput = z.object({ id });
export const reverseJournalInput = z.object({
  id,
  date,
  reason: z.string().trim().min(1).max(500),
});
export const reportFiltersInput = z
  .object({
    from: date.optional(),
    to: date.optional(),
    accountId: id.optional(),
    projectId: id.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Start date must be on or before end date.",
    path: ["from"],
  });
