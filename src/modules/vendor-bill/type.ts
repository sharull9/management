import type { billOptions } from "./server/queries";
export type BillFormData = Awaited<ReturnType<typeof billOptions>>;
export type BillDraftLine = {
  poLineId: string | null;
  grnLineId: string | null;
  itemVariantId: string | null;
  description: string;
  qty: string;
  uomId: string;
  rate: string;
  discountPercent: string;
  taxGroupId: string | null;
  poRate?: string | null;
  receiptName?: string;
};
export type BillInitial = {
  id?: string;
  projectId?: string;
  partyId?: string;
  purchaseOrderId?: string;
  date?: string;
  vendorInvoiceNo?: string;
  vendorInvoiceDate?: string;
  dueDate?: string;
  notes?: string;
};
