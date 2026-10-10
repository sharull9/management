import type { DocumentType } from "@/generated/prisma/client";
export const vendorBillApprovalDocumentPaths: Partial<
  Record<DocumentType, string>
> = { VENDOR_BILL: "procurement/bills" };
