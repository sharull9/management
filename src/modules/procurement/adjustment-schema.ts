import { z } from "zod";
import { date, id, quantity } from "@/core/schema";

const adjustmentFields = z.object({
  projectId: id,
  itemVariantId: id,
  date,
  qty: quantity,
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason for this adjustment.")
    .max(1000),
});

export const adjustmentInput = z.discriminatedUnion("direction", [
  adjustmentFields.extend({
    direction: z.literal("INCREASE"),
    unitCost: z
      .string()
      .regex(
        /^\d{1,14}(?:\.\d{1,8})?$/,
        "Enter a non-negative base-currency unit cost with up to eight decimal places.",
      ),
  }),
  adjustmentFields.extend({
    direction: z.literal("DECREASE"),
    // A hidden increase cost must not block a decrease; valuation is server-owned.
    unitCost: z
      .string()
      .max(100)
      .transform(() => ""),
  }),
]);
