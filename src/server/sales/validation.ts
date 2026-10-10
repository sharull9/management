import { z } from "zod";
import { Decimal } from "../procurement/calculations";
import { date, id, quantity, rate } from "../procurement/validation";
export const invoiceInput = z.object({
  id: id.nullable(),
  projectId: id.nullable(),
  partyId: id.nullable(),
  date,
  dueDate: date.nullable(),
  stateId: id.nullable(),
  notes: z.string().trim().max(4000),
  lines: z
    .array(
      z.object({
        itemId: id.nullable(),
        levels: z.array(id.nullable()).max(5),
        description: z.string().trim().max(1000),
        qty: quantity,
        uomId: id,
        rate,
        discountPercent: rate.refine((v) => new Decimal(v).lte(100)),
        taxGroupId: id.nullable(),
        fromProjectStock: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
});
