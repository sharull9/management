import "server-only";
import { writeAudit } from "@/core/audit";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { ApprovalHandler } from "@/modules/approvals/server/handlers";
import { postDraftJournal } from "./posting-service";

async function journal(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  actorId: string,
  outcome: "APPROVED" | "REJECTED" | "CANCELED",
) {
  const row = await tx.journalEntry.findFirst({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
    },
  });
  // Approval requests can outlive or be detached from their document; never affect another row.
  if (!row) return;
  if (row.status !== "PENDING_APPROVAL") return;
  if (outcome === "APPROVED") {
    await postDraftJournal(tx, request.organizationId, row.id, actorId);
    return;
  }
  await tx.journalEntry.update({
    where: { id: row.id },
    data: { status: "DRAFT", approvalRequestId: null },
  });
  await writeAudit(
    {
      organizationId: request.organizationId,
      userId: actorId,
      entityType: "JournalEntry",
      entityId: row.id,
      action:
        outcome === "REJECTED" ? "APPROVAL_REJECTED" : "APPROVAL_CANCELED",
      changes: { approvalRequestId: request.id },
    },
    tx,
  );
}

export const journalApproval: ApprovalHandler = {
  onApproved: (request, tx, actorId) =>
    journal(request, tx, actorId, "APPROVED"),
  onRejected: (request, tx, actorId) =>
    journal(request, tx, actorId, "REJECTED"),
  onCanceled: (request, tx, actorId) =>
    journal(request, tx, actorId, "CANCELED"),
};
