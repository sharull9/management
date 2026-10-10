import type { DocumentType } from "@/generated/prisma/client";
export const procurementApprovalDocumentPaths: Partial<
  Record<DocumentType, string>
> = {
  PURCHASE_REQUEST: "procurement/requests",
  PURCHASE_ORDER: "procurement/orders",
  GRN: "procurement/receipts",
};
export const inventoryApprovalDocumentPaths: Partial<
  Record<DocumentType, string>
> = { STOCK_TRANSFER: "inventory/transfers" };
