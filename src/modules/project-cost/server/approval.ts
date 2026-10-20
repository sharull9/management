import "server-only";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import { syncCostEntryJournal } from "@/modules/accounting/server/source-costs";
import type { ApprovalHandler } from "@/modules/approvals/server/handlers";
import { costEntryAmounts } from "@/modules/currency/server/cost-entry";
import { auditApprovalEffect } from "@/modules/project/server/approval-audit";

async function expense(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  status: "APPROVED" | "REJECTED" | "CANCELED",
  actorId: string,
) {
  await lockAccountingScope(tx, request.organizationId);
  const row = await tx.expense.findFirstOrThrow({
    where: {
      id: request.documentId,
      approvalRequestId: request.id,
      project: { organizationId: request.organizationId },
    },
  });
  await tx.expense.update({ where: { id: row.id }, data: { status } });
  if (status === "APPROVED") {
    const entry = await tx.costEntry.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: request.organizationId,
          sourceType: "EXPENSE",
          sourceId: row.id,
        },
      },
      create: {
        organizationId: request.organizationId,
        projectId: row.projectId,
        stageId: row.stageId,
        taskId: row.taskId,
        date: row.date,
        costType: row.costType,
        ...(await costEntryAmounts(tx, {
          organizationId: request.organizationId,
          projectId: row.projectId,
          date: row.date,
          currency: row.currency,
          amount: row.amount,
          exchangeRate: row.exchangeRate,
        })),
        description: row.description,
        sourceType: "EXPENSE",
        sourceId: row.id,
        createdById: row.createdById,
      },
      update: {},
    });
    await syncCostEntryJournal(tx, entry, actorId);
    await auditApprovalEffect(
      request,
      tx,
      "CostEntry",
      entry.id,
      "CREATE",
      actorId,
    );
  }
  await auditApprovalEffect(request, tx, "Expense", row.id, status, actorId);
}
export const expenseApproval: ApprovalHandler = {
  onApproved: (r, tx, actorId) => expense(r, tx, "APPROVED", actorId),
  onRejected: (r, tx, actorId) => expense(r, tx, "REJECTED", actorId),
  onCanceled: (r, tx, actorId) => expense(r, tx, "CANCELED", actorId),
};
