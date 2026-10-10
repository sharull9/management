import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { ApprovalHandler } from "../approvals/handlers";

async function updateStatus(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "DRAFT",
): Promise<void> {
  await tx.salesInvoice.update({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
      status: "PENDING_APPROVAL",
    },
    data: { status },
  });
}

// Stable wave-2 contract: (request: ApprovalRequest, tx: Prisma.TransactionClient, actorId: string) => Promise<void>.
// Replace status-only bodies with document effects; keep these exports and avoid importing approval service here.
export const onApproved: ApprovalHandler["onApproved"] = (request, tx) =>
  updateStatus(request, tx, "APPROVED");
export const onRejected: ApprovalHandler["onRejected"] = (request, tx) =>
  updateStatus(request, tx, "DRAFT");
export const onCanceled: NonNullable<ApprovalHandler["onCanceled"]> = (
  request,
  tx,
) => updateStatus(request, tx, "DRAFT");
