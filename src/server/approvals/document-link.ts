import "server-only";
import type { ApprovalRequest } from "@/generated/prisma/client";
import { db } from "../db";
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
        PURCHASE_REQUEST: "procurement/requests",
        PURCHASE_ORDER: "procurement/orders",
        GRN: "procurement/receipts",
        VENDOR_BILL: "procurement/bills",
        PAYMENT_REQUEST: "finance/payment-requests",
        SALES_INVOICE: "sales/invoices",
        STOCK_TRANSFER: "inventory/transfers",
      };
      if (paths[r.documentType])
        return [
          r.id,
          `/${org}/${paths[r.documentType]}/${r.documentId}`,
        ] as const;
      if (!r.projectId) return [r.id, `/${org}/approvals`] as const;
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
