import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import type { allocationsInput, paymentInput } from "../schema";
import {
  amount,
  Decimal,
  REQUIRE_REQUEST_FOR_MODES,
  validateAllocation,
} from "./allocation";

type Tx = Prisma.TransactionClient;

import { syncPaymentJournals } from "@/modules/accounting/server/source-payments";
import { allocatePayment } from "./allocation-service";
import { documentFx } from "./fx";
import { audit, lockSettlement, scope } from "./service";
export async function recordPayment(
  tx: Tx,
  ctx: OrgContext,
  input: z.infer<typeof paymentInput>,
) {
  await lockSettlement(tx, ctx.org.id);
  await scope(tx, ctx, input.projectId, "payment.record");
  const currency = input.currency ?? ctx.org.baseCurrency;
  const fx = await documentFx(tx, ctx, {
    currency,
    date: input.date,
    override: input.exchangeRate,
  });
  // Currencies with fewer minor units (JPY) round to their own decimals.
  const paymentAmount = fx.round(amount(input.amount));
  if (paymentAmount.lte(0))
    throw new UserFacingError("Amount rounds to zero in the payment currency.");
  await tx.party.findFirstOrThrow({
    where: {
      id: input.partyId,
      tenantId: ctx.tenant.id,
      ...(input.direction === "OUTGOING"
        ? { isVendor: true }
        : { isCustomer: true }),
    },
  });
  if (
    input.direction === "OUTGOING" &&
    REQUIRE_REQUEST_FOR_MODES.includes(input.mode) &&
    !input.paymentRequestId
  )
    throw new UserFacingError(
      "This payment mode requires an approved payment request.",
    );
  const request = input.paymentRequestId
    ? await tx.paymentRequest.findFirstOrThrow({
        where: {
          id: input.paymentRequestId,
          organizationId: ctx.org.id,
          status: "APPROVED",
        },
        include: {
          bills: { orderBy: { id: "asc" } },
          payments: {
            where: { status: "POSTED" },
            include: { allocations: true },
          },
        },
      })
    : null;
  const auto: z.infer<typeof allocationsInput> = [];
  if (request) {
    await scope(tx, ctx, request.projectId, "payment.record");
    if (
      input.direction !== "OUTGOING" ||
      request.partyId !== input.partyId ||
      request.currency !== currency ||
      request.projectId !== input.projectId ||
      request.mode !== input.mode
    )
      throw new UserFacingError(
        "Payment must match request party, project, currency, direction and mode.",
      );
    const remaining = request.amount.sub(
      request.payments.reduce((v, p) => v.add(p.amount), new Decimal(0)),
    );
    validateAllocation(remaining, remaining, paymentAmount);
    let available = paymentAmount;
    for (const b of request.bills) {
      const already = request.payments
        .flatMap((p) => p.allocations)
        .filter((a) => a.vendorBillId === b.billId)
        .reduce((v, a) => v.add(a.amount), new Decimal(0));
      const needed = Decimal.max(0, b.amount.sub(already));
      const value = Decimal.min(available, needed);
      if (value.gt(0))
        auto.push({ documentId: b.billId, amount: value.toFixed(2) });
      available = available.sub(value);
    }
    if (request.purpose === "BILL_SETTLEMENT" && available.gt(0))
      throw new UserFacingError(
        "Request bill allocations no longer match its unpaid amount.",
      );
  }
  const {
    paymentRequestId,
    reference,
    notes,
    exchangeRate: _override,
    ...base
  } = input;
  const row = await tx.payment.create({
    data: {
      ...base,
      currency,
      exchangeRate: fx.exchangeRate,
      baseAmount: fx.toBase(paymentAmount),
      reference: reference || null,
      notes: notes || null,
      paymentRequestId,
      amount: paymentAmount,
      unallocatedAmount: paymentAmount,
      allocatedAmount: "0",
      organizationId: ctx.org.id,
      createdById: ctx.user.id,
      code: await nextDocumentNumber(ctx.org.id, "PAY", tx),
    },
  });
  if (auto.length) await allocatePayment(tx, ctx, row.id, auto);
  if (request) {
    const paid = request.payments.reduce(
      (v, p) => v.add(p.amount),
      paymentAmount,
    );
    if (paid.eq(request.amount))
      await tx.paymentRequest.update({
        where: { id: request.id },
        data: { status: "PAID" },
      });
    await audit(tx, ctx, "PaymentRequest", request.id, "PAYMENT");
  }
  await audit(tx, ctx, "Payment", row.id, "CREATE");
  await syncPaymentJournals(tx, ctx.org.id, row.id, ctx.user.id);
  return row;
}
