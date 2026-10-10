import type { DocumentType } from "@/generated/prisma/client";
export const salesInvoiceApprovalDocumentPaths: Partial<
  Record<DocumentType, string>
> = { SALES_INVOICE: "sales/invoices" };
