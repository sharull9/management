import "server-only";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { validateRequestBills } from "./request-service";
import { audit, lockSettlement, scope } from "./service";

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
  const { submitForApproval } = await import(
    "@/modules/approvals/server/service"
  );
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
