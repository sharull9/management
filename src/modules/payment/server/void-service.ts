import "server-only";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

import { syncPaymentJournals } from "@/modules/accounting/server/source-payments";
import { recomputeDocument } from "./allocation-service";
import { audit, lockSettlement, scope, target } from "./service";
export async function voidPayment(
  tx: Tx,
  ctx: OrgContext,
  paymentId: string,
  reason: string,
) {
  await lockSettlement(tx, ctx.org.id);
  const payment = await tx.payment.findFirstOrThrow({
    where: { id: paymentId, organizationId: ctx.org.id, status: "POSTED" },
    include: { allocations: true },
  });
  await scope(tx, ctx, payment.projectId, "payment.record");
  for (const a of payment.allocations)
    await target(
      tx,
      ctx,
      payment,
      (a.vendorBillId ?? a.salesInvoiceId) as string,
      "payment.record",
    );
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: "VOID",
      allocatedAmount: "0",
      unallocatedAmount: payment.amount,
      notes: `${payment.notes ?? ""}\nVoided: ${reason}`,
    },
  });
  // Retain allocations as the historical reversal trail; active sums exclude VOID payments.
  for (const a of payment.allocations)
    await recomputeDocument(
      tx,
      payment.direction,
      (a.vendorBillId ?? a.salesInvoiceId) as string,
    );
  if (payment.paymentRequestId)
    await tx.paymentRequest.update({
      where: { id: payment.paymentRequestId },
      data: { status: "APPROVED" },
    });
  await audit(tx, ctx, "Payment", payment.id, "VOID");
  await syncPaymentJournals(tx, ctx.org.id, payment.id, ctx.user.id);
}
