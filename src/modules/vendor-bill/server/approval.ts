import { Decimal } from "@/core/decimal";
import "server-only";
import { writeAudit } from "@/core/audit";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { ApprovalHandler } from "@/modules/approvals/server/handlers";
import { costEntryAmounts } from "@/modules/currency/server/cost-entry";

import { lockDocument } from "@/modules/procurement/server/service";
import { assertBillReceipts } from "./service";

async function decide(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  actorId: string,
  approved: boolean,
) {
  await lockDocument(tx, "BILL", request.documentId);
  const bill = await tx.vendorBill.findFirstOrThrow({
    where: {
      id: request.documentId,
      organizationId: request.organizationId,
      approvalRequestId: request.id,
      status: "PENDING_APPROVAL",
    },
    include: { lines: true, organization: { select: { tenantId: true } } },
  });
  if (approved) {
    await assertBillReceipts(
      tx,
      bill.organizationId,
      bill.id,
      bill.purchaseOrderId,
      bill.lines,
    );
    const amount = bill.lines.reduce(
      (sum, line) => sum.add(line.varianceAmount),
      new Decimal(0),
    );
    if (!amount.isZero()) {
      const cost = await tx.costEntry.create({
        data: {
          organizationId: bill.organizationId,
          projectId: bill.projectId,
          date: bill.date,
          costType: "MATERIAL",
          // Line variances are stored in BASE currency (bill line base minus the
          // matched receipt base, FX included), so the entry's original currency
          // is the base currency at rate 1.
          ...(await costEntryAmounts(tx, {
            organizationId: bill.organizationId,
            projectId: bill.projectId,
            date: bill.date,
            amount,
          })),
          description: `${bill.code} bill price variance`,
          sourceType: "BILL_VARIANCE",
          sourceId: bill.id,
          createdById: actorId,
        },
      });
      await writeAudit(
        {
          tenantId: bill.organization.tenantId,
          organizationId: bill.organizationId,
          userId: actorId,
          entityType: "CostEntry",
          entityId: cost.id,
          action: "CREATE",
        },
        tx,
      );
    }
  }
  await tx.vendorBill.update({
    where: { id: bill.id },
    data: { status: approved ? "APPROVED" : "DRAFT" },
  });
  await writeAudit(
    {
      tenantId: bill.organization.tenantId,
      organizationId: bill.organizationId,
      userId: actorId,
      entityType: "VendorBill",
      entityId: bill.id,
      action: approved ? "APPROVE" : "RETURN_TO_DRAFT",
    },
    tx,
  );
}
export const onApproved: ApprovalHandler["onApproved"] = (
  request,
  tx,
  actorId,
) => decide(request, tx, actorId, true);
export const onRejected: ApprovalHandler["onRejected"] = (
  request,
  tx,
  actorId,
) => decide(request, tx, actorId, false);
export const onCanceled: NonNullable<ApprovalHandler["onCanceled"]> = (
  request,
  tx,
  actorId,
) => decide(request, tx, actorId, false);

export const vendorBillApproval: ApprovalHandler = {
  onApproved,
  onRejected,
  onCanceled,
};
