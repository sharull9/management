import { z } from "zod";
import type { PickerItem } from "@/components/shared/form/item-variant-value";
import { Decimal } from "@/core/decimal";
import { date, id, quantity, rate } from "@/core/schema";
import { variantIdentity } from "@/modules/item-variant/util";
import { currencyFields } from "@/modules/payment/schema";

export const invoiceInput = z.object({
  id: id.nullable(),
  projectId: id.nullable(),
  partyId: id.nullable(),
  date,
  dueDate: date.nullable(),
  stateId: id.nullable(),
  ...currencyFields,
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

const selection = z.object({
  itemId: id.nullable(),
  level1: id.nullable(),
  level2: id.nullable(),
  level3: id.nullable(),
  level4: id.nullable(),
  level5: id.nullable(),
});
export const invoiceLineInput = invoiceInput.shape.lines.element
  .omit({ itemId: true, levels: true })
  .extend({
    lineType: z.enum(["GOODS", "SERVICE"]),
    selection,
    uomId: id.nullable(),
  })
  .superRefine((line, ctx) => {
    if (!line.uomId)
      ctx.addIssue({
        code: "custom",
        path: ["uomId"],
        message: "Select a unit.",
      });
    if (line.lineType === "GOODS" && !line.selection.itemId)
      ctx.addIssue({
        code: "custom",
        path: ["selection", "itemId"],
        message: "Select an item.",
      });
    if (line.lineType === "SERVICE") {
      if (!line.description)
        ctx.addIssue({
          code: "custom",
          path: ["description"],
          message: "Services need a description.",
        });
      if (Object.values(line.selection).some(Boolean))
        ctx.addIssue({
          code: "custom",
          path: ["selection"],
          message: "Services cannot have item levels.",
        });
      if (line.fromProjectStock)
        ctx.addIssue({
          code: "custom",
          path: ["fromProjectStock"],
          message: "Services cannot use project stock.",
        });
    }
  });
export const invoiceFormInput = invoiceInput
  .omit({ lines: true, dueDate: true })
  .extend({
    dueDate: z.union([date, z.literal("").transform(() => null), z.null()]),
    lines: z.array(invoiceLineInput).min(1).max(100),
  })
  .superRefine((input, ctx) => {
    if (!input.partyId && !input.projectId)
      ctx.addIssue({
        code: "custom",
        path: ["partyId"],
        message: "Select a customer.",
      });
    if (input.dueDate && input.dueDate < input.date)
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date cannot precede invoice date.",
      });
    input.lines.forEach((line, index) => {
      if (line.fromProjectStock && !input.projectId)
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "fromProjectStock"],
          message: "Project stock needs a project.",
        });
    });
  });

export function invoiceFormSchema(items: PickerItem[]) {
  return invoiceFormInput.superRefine((input, ctx) => {
    input.lines.forEach((line, index) => {
      if (line.lineType !== "GOODS" || !line.selection.itemId) return;
      const item = items.find((item) => item.id === line.selection.itemId);
      try {
        if (!item) throw new Error("Select an available item.");
        variantIdentity(item, item.configs, selectedLevels(line.selection));
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "selection"],
          message:
            error instanceof Error ? error.message : "Invalid item levels.",
        });
      }
    });
  });
}

export function selectedLevels(value: z.input<typeof selection>) {
  return [value.level1, value.level2, value.level3, value.level4, value.level5];
}

export const submitInvoiceInput = z.object({ id });
export const invoiceFiltersInput = z.object({
  customerId: id.nullable(),
  projectId: id.nullable(),
  status: z
    .enum([
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "PARTIALLY_PAID",
      "PAID",
      "CANCELLED",
    ])
    .nullable(),
  overdue: z.boolean(),
});

export function invoiceServiceValues(
  parsed: z.output<typeof invoiceFormInput>,
): z.output<typeof invoiceInput> {
  return {
    ...parsed,
    lines: parsed.lines.map(({ selection, lineType: _lineType, ...line }) => ({
      ...line,
      uomId: line.uomId ?? "",
      itemId: selection.itemId,
      levels: selectedLevels(selection),
    })),
  };
}
