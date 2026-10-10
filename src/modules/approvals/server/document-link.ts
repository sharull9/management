import "server-only";
import type { ApprovalRequest } from "@/generated/prisma/client";
import { paymentApprovalDocumentPaths } from "@/modules/payment";
import {
  inventoryApprovalDocumentPaths,
  procurementApprovalDocumentPaths,
} from "@/modules/procurement";
import { resolveTaskApprovalDocumentId } from "@/modules/project-task";
import { salesInvoiceApprovalDocumentPaths } from "@/modules/sales-invoice";
import { vendorBillApprovalDocumentPaths } from "@/modules/vendor-bill";
// Titles for finance submission callers; ApprovalRequest.title stores the document-specific title.
export const financeDocumentTitles = {
  VENDOR_BILL: "Vendor bill",
  PAYMENT_REQUEST: "Payment request",
  SALES_INVOICE: "Sales invoice",
} as const;

export async function approvalDocumentLinks(
  org: string,
  requests: Pick<
    ApprovalRequest,
    "id" | "organizationId" | "documentType" | "documentId" | "projectId"
  >[],
) {
  const links = await Promise.all(
    requests.map(async (r) => {
      const paths: Partial<Record<ApprovalRequest["documentType"], string>> = {
        ...procurementApprovalDocumentPaths,
        ...inventoryApprovalDocumentPaths,
        ...vendorBillApprovalDocumentPaths,
        ...paymentApprovalDocumentPaths,
        ...salesInvoiceApprovalDocumentPaths,
      };
      if (paths[r.documentType])
        return [
          r.id,
          `/${org}/${paths[r.documentType]}/${r.documentId}`,
        ] as const;
      if (!r.projectId) return [r.id, `/${org}/approvals`] as const;
      const taskId = await resolveTaskApprovalDocumentId(r);
      return [
        r.id,
        taskId
          ? `/${org}/projects/${r.projectId}/tasks/${taskId}`
          : `/${org}/projects/${r.projectId}/costs`,
      ] as const;
    }),
  );
  return new Map(links);
}
