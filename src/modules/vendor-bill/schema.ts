import { z } from "zod";
import { Decimal } from "@/core/decimal";
import { date, id, quantity, rate } from "@/core/schema";
import { exchangeRateInput } from "@/modules/procurement/schema";

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
  /** Null resolves to the PO's currency, else the vendor default, else base. */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .default(null),
  /** User-confirmed base-per-document-unit rate; null resolves the dated rate. */
  exchangeRate: exchangeRateInput,
  notes: z.string().trim().max(4000).default(""),
  lines: z.array(billLineInput).min(1).max(100),
});

export const billDocumentInput = z.object({ id });
export const billFilterInput = z.object({
  projectId: id.nullable(),
  partyId: id.nullable(),
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
  overdue: z.literal("1").nullable(),
});

export const billAttachmentInput = z
  .instanceof(File)
  .refine(
    (file) => file.size > 0 && file.size <= 900000,
    "Select a PDF or image up to 900 KB.",
  )
  .refine(
    (file) =>
      ["application/pdf", "image/png", "image/jpeg"].includes(file.type),
    "Only PDF, PNG and JPEG files are supported.",
  );

export const billFormInput = billInput.extend({
  dueDate: z.union([date, z.literal("").transform(() => null), z.null()]),
  // A cleared rate field resolves the dated rate on the server.
  exchangeRate: z.union([
    exchangeRateInput,
    z.literal("").transform(() => null),
  ]),
  attachment: billAttachmentInput.nullable(),
});
export const billAttachmentFormInput = billDocumentInput.extend({
  attachment: billAttachmentInput,
});

// Keep files outside the JSON payload; validate the complete upload at the server boundary.
export const billUploadInput = z
  .instanceof(FormData)
  .transform((data, ctx) => {
    try {
      const payload = z.string().max(250000).parse(data.get("payload"));
      const parsed: unknown = JSON.parse(payload);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error();
      return { ...parsed, attachment: data.get("attachment") ?? null };
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid bill payload." });
      return z.NEVER;
    }
  })
  .pipe(billFormInput);
