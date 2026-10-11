import { z } from "zod";
import { Decimal } from "@/core/decimal";
import { date, id, quantity, rate } from "@/core/schema";
import { variantIdentity } from "@/modules/item-variant/util";
import type { ProcurementItem } from "./type";

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

// Service schemas remain unchanged for direct service callers.
export const procurementKind = z.enum([
  "requests",
  "orders",
  "receipts",
  "consumption",
  "transfers",
]);
export const documentSubmissionInput = z.object({
  kind: z.enum(["requests", "orders", "receipts", "transfers"]),
  id,
});
export const formLine = z.object({
  item: z.object({
    itemId: id.nullable(),
    level1: id.nullable(),
    level2: id.nullable(),
    level3: id.nullable(),
    level4: id.nullable(),
    level5: id.nullable(),
  }),
  qty: z.number(),
  uomId: id.nullable(),
  description: z.string(),
  estimatedRate: z.number(),
  rate: z.number(),
  discountPercent: z.number(),
  taxGroupId: id.nullable(),
  prLineId: id.nullable(),
  poLineId: id.nullable(),
  receivedQty: z.number(),
  acceptedQty: z.number(),
  rejectedQty: z.number(),
  remarks: z.string(),
});
const formObject = z.object({
  kind: procurementKind,
  id: id.nullable(),
  projectId: id.nullable(),
  stageId: id.nullable(),
  taskId: id.nullable(),
  neededBy: z.string().nullable(),
  vendorPartyId: id.nullable(),
  siteId: id.nullable(),
  date: z.string(),
  paymentTerms: z.enum(["CREDIT", "CASH", "ADVANCE"]),
  paymentDays: z.number(),
  currency: z.string(),
  receiptTolerancePercent: z.number(),
  poId: id.nullable(),
  receivedDate: z.string(),
  challanNumber: z.string().nullable(),
  vehicleNumber: z.string().nullable(),
  toProjectId: id.nullable(),
  lines: z.array(formLine).min(1).max(100),
});
export const serviceSchemas = {
  requests: requestInput,
  orders: orderInput,
  receipts: receiptInput,
  consumption: consumptionInput,
  transfers: transferInput,
};
export function procurementServiceInput(input: z.input<typeof formObject>) {
  return {
    ...input,
    neededBy: input.neededBy?.trim() || null,
    challanNumber: input.challanNumber?.trim() || null,
    vehicleNumber: input.vehicleNumber?.trim() || null,
    receiptTolerancePercent: String(input.receiptTolerancePercent),
    lines: input.lines.map(({ item, ...line }) => ({
      ...line,
      itemId: item.itemId,
      levels: [item.level1, item.level2, item.level3, item.level4, item.level5],
      qty: String(line.qty),
      estimatedRate: String(line.estimatedRate),
      rate: String(line.rate),
      discountPercent: String(line.discountPercent),
      receivedQty: String(line.receivedQty),
      acceptedQty: String(line.acceptedQty),
      rejectedQty: String(line.rejectedQty),
    })),
  };
}
export const procurementFormInput = formObject.superRefine((input, ctx) => {
  const result = serviceSchemas[input.kind].safeParse(
    procurementServiceInput(input),
  );
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = [...issue.path];
      if (path[0] === "lines" && path[2] === "itemId")
        path.splice(2, 1, "item", "itemId");
      if (input.kind === "receipts" && path[0] === "lines" && path.length === 2)
        path.push("acceptedQty");
      ctx.addIssue({ code: "custom", path, message: issue.message });
    }
  }
});

// Resolver validation supplements the service's authoritative tenant/config checks.
export function procurementFormSchema(items: ProcurementItem[]) {
  return procurementFormInput.superRefine((input, ctx) => {
    if (input.kind === "receipts") return;
    input.lines.forEach((line, index) => {
      const item = items.find((item) => item.id === line.item.itemId);
      if (!item) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "item", "itemId"],
          message: "Select an available item.",
        });
        return;
      }
      try {
        variantIdentity(item, item.configs, [
          line.item.level1,
          line.item.level2,
          line.item.level3,
          line.item.level4,
          line.item.level5,
        ]);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "item"],
          message:
            error instanceof Error ? error.message : "Invalid item levels.",
        });
      }
      if (!line.uomId || !item.uomIds.includes(line.uomId))
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "uomId"],
          message: "Choose a unit from the item's UOM group.",
        });
    });
  });
}
