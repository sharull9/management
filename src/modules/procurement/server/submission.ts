import "server-only";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { submitForApproval } from "@/modules/approvals";
import {
  type DocumentKind,
  document,
  documentKinds,
  updateDocument,
} from "./approval";
import { domainAudit, lockDocument } from "./service";
export async function submitDocument(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  kind: DocumentKind,
  documentId: string,
) {
  const config = documentKinds[kind];
  await lockDocument(tx, config.lock, documentId);
  const row = await document(tx, kind, ctx.org.id, documentId);
  if (row.status !== "DRAFT") throw new Error("Only drafts may be submitted.");
  if (kind === "orders") {
    const lines = await tx.purchaseOrderLine.findMany({
      where: { orderId: row.id },
      include: { prLine: { include: { request: true } } },
    });
    if (lines.some((l) => l.prLine && l.prLine.request.status !== "APPROVED"))
      throw new Error("Linked purchase requests must remain approved.");
  }
  const amount =
    "estimatedTotal" in row
      ? row.estimatedTotal.toString()
      : "grandTotal" in row
        ? row.grandTotal.toString()
        : undefined;
  const approval = await submitForApproval(
    {
      orgSlug: ctx.org.slug,
      documentType: config.documentType,
      documentId: row.id,
      title: `${row.code} · ${{ requests: "Purchase request", orders: "Purchase order", receipts: "Goods receipt", transfers: "Stock transfer" }[kind]}`,
      projectId: row.projectId,
      stageId: "stageId" in row ? row.stageId : null,
      amount,
    },
    tx,
    ctx,
  );
  await updateDocument(tx, kind, row.id, {
    status: "PENDING_APPROVAL",
    approvalRequestId: approval.id,
  });
  await domainAudit(ctx, tx, config.entity, row.id, "SUBMIT");
  return approval;
}
