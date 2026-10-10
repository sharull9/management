import type { DocumentType } from "@/generated/prisma/client";
export const paymentApprovalDocumentPaths: Partial<
  Record<DocumentType, string>
> = { PAYMENT_REQUEST: "finance/payment-requests" };
export const modes = ["CASH", "BANK", "UPI", "CHEQUE", "OTHER"];
