import { z } from "zod";
import { Decimal } from "./calculations";
export const id = z.string().min(1).max(100);
export const quantity = z
  .string()
  .regex(/^\d{1,14}(?:\.\d{1,4})?$/)
  .refine((v) => new Decimal(v).gt(0), "Quantity must be positive.");
export const rate = z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/);
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
export const variantSelection = z.object({
  itemId: id,
  levels: z.array(id.nullable()).max(5).default([]),
});
export const requestLine = variantSelection.extend({
  description: z.string().trim().max(1000).default(""),
  qty: quantity,
  uomId: id,
  estimatedRate: rate,
});
export const orderLine = variantSelection.extend({
  description: z.string().trim().max(1000).default(""),
  qty: quantity,
  uomId: id,
  rate,
  discountPercent: rate.refine(
    (v) => new Decimal(v).lte(100),
    "Discount cannot exceed 100%.",
  ),
  taxGroupId: id.nullable(),
  prLineId: id.nullable(),
});
export const receiptLine = z
  .object({
    poLineId: id,
    receivedQty: quantity,
    acceptedQty: rate,
    rejectedQty: rate,
    uomId: id,
    remarks: z.string().trim().max(1000).default(""),
  })
  .refine(
    (l) => new Decimal(l.acceptedQty).add(l.rejectedQty).eq(l.receivedQty),
    "Accepted + rejected must equal received quantity.",
  );
export const stockLine = variantSelection.extend({ qty: quantity, uomId: id });
export const requestInput = z.object({
  id: id.nullable(),
  projectId: id,
  stageId: id.nullable(),
  taskId: id.nullable(),
  neededBy: date.nullable(),
  lines: z.array(requestLine).min(1).max(100),
});
export const orderInput = z.object({
  id: id.nullable(),
  projectId: id,
  vendorPartyId: id,
  siteId: id.nullable(),
  date,
  paymentTerms: z.enum(["CREDIT", "CASH", "ADVANCE"]),
  paymentDays: z.coerce.number().int().min(0).max(3650),
  currency: z.string().regex(/^[A-Z]{3}$/),
  receiptTolerancePercent: rate.refine((v) => new Decimal(v).lte(100)),
  lines: z.array(orderLine).min(1).max(100),
});
export const receiptInput = z.object({
  id: id.nullable(),
  projectId: id,
  poId: id,
  siteId: id.nullable(),
  receivedDate: date,
  challanNumber: z.string().max(100).nullable(),
  vehicleNumber: z.string().max(100).nullable(),
  lines: z.array(receiptLine).min(1).max(100),
});
export const consumptionInput = z.object({
  projectId: id,
  stageId: id.nullable(),
  taskId: id.nullable(),
  date,
  lines: z.array(stockLine).min(1).max(100),
});
export const transferInput = z.object({
  id: id.nullable(),
  projectId: id,
  toProjectId: id,
  date,
  lines: z.array(stockLine).min(1).max(100),
});
