import { z } from "zod";
import { Decimal } from "@/core/decimal";
import { date, id, quantity, rate } from "@/core/schema";

export const billLineInput = z.object({
  poLineId: id.nullable().default(null),
  grnLineId: id.nullable().default(null),
  itemVariantId: id.nullable().default(null),
  description: z.string().trim().min(1).max(1000),
  qty: quantity,
  uomId: id,
  rate,
  discountPercent: rate.refine(
    (v) => new Decimal(v).lte(100),
    "Discount cannot exceed 100%.",
  ),
  taxGroupId: id.nullable().default(null),
});
export const billInput = z.object({
  id: id.nullable(),
  projectId: id,
  partyId: id,
  purchaseOrderId: id.nullable(),
  date,
  vendorInvoiceNo: z.string().trim().min(1).max(200),
  vendorInvoiceDate: date,
  dueDate: date.nullable(),
  notes: z.string().trim().max(4000).default(""),
  lines: z.array(billLineInput).min(1).max(100),
});
