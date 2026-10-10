import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { submitForApproval } from "../approvals/service";
import type { OrgContext } from "../context";
import { audit, lockSettlement, scope, validateRequestBills } from "./service";

export async function submitRequest(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  id: string,
) {
  await lockSettlement(tx, ctx.org.id);
  const row = await tx.paymentRequest.findFirstOrThrow({
    where: { id, organizationId: ctx.org.id, status: "DRAFT" },
    include: { bills: true },
  });
  await scope(tx, ctx, row.projectId, "payment.request.create");
  await validateRequestBills(tx, row, ctx);
  const approval = await submitForApproval(
    {
      orgSlug: ctx.org.slug,
      documentType: "PAYMENT_REQUEST",
      documentId: id,
      title: `${row.code} · Payment request`,
      projectId: row.projectId,
      amount: row.amount.toString(),
    },
    tx,
    ctx,
  );
  await tx.paymentRequest.update({
    where: { id },
    data: { status: "PENDING_APPROVAL", approvalRequestId: approval.id },
  });
  await audit(tx, ctx, "PaymentRequest", id, "SUBMIT");
}
