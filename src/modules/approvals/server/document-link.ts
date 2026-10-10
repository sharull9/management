import "server-only";
import { db } from "@/core/db";
import type { ApprovalRequest } from "@/generated/prisma/client";
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
        // R2 G3: procurement and vendor-bill paths.
        PURCHASE_REQUEST: "procurement/requests",
        PURCHASE_ORDER: "procurement/orders",
        GRN: "procurement/receipts",
        VENDOR_BILL: "procurement/bills",
        // R2 G4: payment and sales-invoice paths.
        PAYMENT_REQUEST: "finance/payment-requests",
        SALES_INVOICE: "sales/invoices",
        // R2 G3: inventory path.
        STOCK_TRANSFER: "inventory/transfers",
      };
      if (paths[r.documentType])
        return [
          r.id,
          `/${org}/${paths[r.documentType]}/${r.documentId}`,
        ] as const;
      if (!r.projectId) return [r.id, `/${org}/approvals`] as const;
      // BEGIN R2 G2 task document lookup
      let taskId: string | null = null;
      if (r.documentType === "TASK_SUBMISSION")
        taskId =
          (
            await db.taskSubmission.findFirst({
              where: {
                id: r.documentId,
                task: {
                  projectId: r.projectId,
                  project: { organizationId: r.organizationId },
                },
              },
              select: { taskId: true },
            })
          )?.taskId ?? null;
      if (r.documentType === "TASK_DELAY")
        taskId =
          (
            await db.taskDelayRequest.findFirst({
              where: {
                id: r.documentId,
                task: {
                  projectId: r.projectId,
                  project: { organizationId: r.organizationId },
                },
              },
              select: { taskId: true },
            })
          )?.taskId ?? null;
      // END R2 G2 task document lookup
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
