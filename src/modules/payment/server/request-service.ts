import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import type { requestInput } from "../schema";
import {
  amount,
  Decimal,
  settledStatuses,
  validateAllocation,
} from "./allocation";

type Tx = Prisma.TransactionClient;

import { audit, lockSettlement, scope, target } from "./service";
export async function validateRequestBills(
  tx: Tx,
  request: {
    organizationId: string;
    partyId: string;
    currency: string;
    projectId: string | null;
    amount: Prisma.Decimal;
    purpose: string;
    bills: { billId: string; amount: Prisma.Decimal }[];
  },
  ctx?: OrgContext,
) {
  const sum = request.bills.reduce((v, b) => v.add(b.amount), new Decimal(0));
  if (
    request.purpose === "BILL_SETTLEMENT"
      ? !request.bills.length || !sum.eq(request.amount)
      : request.bills.length > 0
  )
    throw new Error(
      "Bill settlement amounts must equal the request amount; other purposes cannot select bills.",
    );
  for (const line of request.bills) {
    const b = await tx.vendorBill.findFirstOrThrow({
      where: {
        id: line.billId,
        organizationId: request.organizationId,
        partyId: request.partyId,
        currency: request.currency,
        status: { in: [...settledStatuses] },
        ...(request.projectId ? { projectId: request.projectId } : {}),
      },
    });
    if (ctx) await scope(tx, ctx, b.projectId, "payment.request.create");
    validateAllocation(
      request.amount,
      b.payableTotal.sub(b.paidTotal),
      line.amount,
    );
  }
}
export async function saveRequest(
  tx: Tx,
  ctx: OrgContext,
  input: z.infer<typeof requestInput>,
) {
  await lockSettlement(tx, ctx.org.id);
  const currency = await scope(
    tx,
    ctx,
    input.projectId,
    "payment.request.create",
  );
  await tx.party.findFirstOrThrow({
    where: { id: input.partyId, tenantId: ctx.tenant.id, isVendor: true },
  });
  for (const a of input.allocations)
    await target(
      tx,
      ctx,
      {
        direction: "OUTGOING",
        partyId: input.partyId,
        currency,
        projectId: input.projectId,
      },
      a.documentId,
      "payment.request.create",
    );
  const data = {
    partyId: input.partyId,
    projectId: input.projectId,
    currency,
    amount: amount(input.amount),
    date: input.date,
    purpose: input.purpose,
    mode: input.mode,
    reason: input.reason,
  };
  await validateRequestBills(tx, {
    ...data,
    organizationId: ctx.org.id,
    bills: input.allocations.map((a) => ({
      billId: a.documentId,
      amount: amount(a.amount),
    })),
  });
  if (input.id) {
    const previous = await tx.paymentRequest.findFirstOrThrow({
      where: { id: input.id, organizationId: ctx.org.id, status: "DRAFT" },
    });
    await scope(tx, ctx, previous.projectId, "payment.request.create");
    await tx.paymentRequestBill.deleteMany({
      where: { paymentRequestId: previous.id },
    });
  }
  const bills = {
    create: input.allocations.map((a) => ({
      billId: a.documentId,
      amount: a.amount,
    })),
  };
  const row = input.id
    ? await tx.paymentRequest.update({
        where: { id: input.id },
        data: { ...data, bills },
      })
    : await tx.paymentRequest.create({
        data: {
          ...data,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "PAYREQ", tx),
          requestedById: ctx.user.id,
          bills,
        },
      });
  await audit(
    tx,
    ctx,
    "PaymentRequest",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
