import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import type { allocationsInput } from "../schema";
import { Decimal, settlementStatus, validateAllocation } from "./allocation";

type Tx = Prisma.TransactionClient;

import { audit, lockSettlement, scope, target } from "./service";
export async function recomputeDocument(
  tx: Tx,
  direction: string,
  documentId: string,
) {
  if (direction === "OUTGOING") {
    const row = await tx.vendorBill.findUniqueOrThrow({
      where: { id: documentId },
    });
    const sum = await tx.paymentAllocation.aggregate({
      where: { vendorBillId: documentId, payment: { status: "POSTED" } },
      _sum: { amount: true },
    });
    const total = sum._sum.amount ?? new Decimal(0);
    await tx.vendorBill.update({
      where: { id: row.id },
      data: {
        paidTotal: total,
        status: settlementStatus(row.payableTotal, total),
      },
    });
  } else {
    const row = await tx.salesInvoice.findUniqueOrThrow({
      where: { id: documentId },
    });
    const sum = await tx.paymentAllocation.aggregate({
      where: { salesInvoiceId: documentId, payment: { status: "POSTED" } },
      _sum: { amount: true },
    });
    const total = sum._sum.amount ?? new Decimal(0);
    await tx.salesInvoice.update({
      where: { id: row.id },
      data: {
        receivedTotal: total,
        status: settlementStatus(row.payableTotal, total),
      },
    });
  }
}
export async function allocatePayment(
  tx: Tx,
  ctx: OrgContext,
  paymentId: string,
  allocations: z.infer<typeof allocationsInput>,
) {
  if (new Set(allocations.map((a) => a.documentId)).size !== allocations.length)
    throw new Error("Select each document once.");
  await lockSettlement(tx, ctx.org.id);
  const payment = await tx.payment.findFirstOrThrow({
    where: { id: paymentId, organizationId: ctx.org.id, status: "POSTED" },
  });
  await scope(tx, ctx, payment.projectId, "payment.record");
  let available = new Decimal(payment.unallocatedAmount);
  const checked = [];
  for (const a of allocations) {
    const { outstanding } = await target(
      tx,
      ctx,
      payment,
      a.documentId,
      "payment.record",
    );
    const value = validateAllocation(available, outstanding, a.amount);
    available = available.sub(value);
    checked.push({ ...a, value });
  }
  for (const a of checked) {
    const allocation = await tx.paymentAllocation.create({
      data: {
        paymentId,
        amount: a.value,
        allocatedById: ctx.user.id,
        ...(payment.direction === "OUTGOING"
          ? { vendorBillId: a.documentId }
          : { salesInvoiceId: a.documentId }),
      },
    });
    await recomputeDocument(tx, payment.direction, a.documentId);
    await audit(tx, ctx, "PaymentAllocation", allocation.id, "CREATE");
  }
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      allocatedAmount: payment.amount.sub(available),
      unallocatedAmount: available,
    },
  });
  await audit(tx, ctx, "Payment", paymentId, "ALLOCATE");
}
