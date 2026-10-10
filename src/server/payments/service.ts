import "server-only";
import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, type OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { moduleProjectWhere } from "../procurement/queries";
import {
  amount,
  Decimal,
  REQUIRE_REQUEST_FOR_MODES,
  settledStatuses,
  settlementStatus,
  validateAllocation,
} from "./allocation";
import type {
  allocationsInput,
  paymentInput,
  requestInput,
} from "./validation";

type Tx = Prisma.TransactionClient;
export async function lockSettlement(tx: Tx, organizationId: string) {
  // One lock order for recording, allocating, voiding and approval validation.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`settlement:${organizationId}`}))::text`;
}
export async function audit(
  tx: Tx,
  ctx: OrgContext,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
    },
    tx,
  );
}
export async function scope(
  tx: Tx,
  ctx: OrgContext,
  projectId: string | null,
  permission: string,
) {
  assertPermission(ctx, permission);
  if (
    "project" in ctx &&
    (ctx as OrgContext & { project: { id: string } }).project.id !== projectId
  )
    throw new Error("Document is outside the authorized project.");
  if (!projectId) return ctx.org.baseCurrency;
  const p = await tx.project.findFirstOrThrow({
    where: { ...moduleProjectWhere(ctx, permission), id: projectId },
  });
  return p.currency;
}
async function target(
  tx: Tx,
  ctx: OrgContext,
  payment: {
    direction: string;
    partyId: string;
    currency: string;
    projectId: string | null;
  },
  documentId: string,
  permission: string,
) {
  const where = {
    id: documentId,
    organizationId: ctx.org.id,
    partyId: payment.partyId,
    currency: payment.currency,
    status: { in: [...settledStatuses] },
    ...(payment.projectId ? { projectId: payment.projectId } : {}),
  };
  const row =
    payment.direction === "OUTGOING"
      ? await tx.vendorBill.findFirstOrThrow({ where })
      : await tx.salesInvoice.findFirstOrThrow({ where });
  await scope(tx, ctx, row.projectId, permission);
  return {
    row,
    outstanding: row.payableTotal.sub(
      "paidTotal" in row ? row.paidTotal : row.receivedTotal,
    ),
  };
}
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
async function recomputeDocument(
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
export async function recordPayment(
  tx: Tx,
  ctx: OrgContext,
  input: z.infer<typeof paymentInput>,
) {
  await lockSettlement(tx, ctx.org.id);
  const currency = await scope(tx, ctx, input.projectId, "payment.record");
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
    throw new Error("This payment mode requires an approved payment request.");
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
      throw new Error(
        "Payment must match request party, project, currency, direction and mode.",
      );
    const remaining = request.amount.sub(
      request.payments.reduce((v, p) => v.add(p.amount), new Decimal(0)),
    );
    validateAllocation(remaining, remaining, input.amount);
    let available = amount(input.amount);
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
      throw new Error(
        "Request bill allocations no longer match its unpaid amount.",
      );
  }
  const { paymentRequestId, reference, notes, ...base } = input;
  const row = await tx.payment.create({
    data: {
      ...base,
      currency,
      reference: reference || null,
      notes: notes || null,
      paymentRequestId,
      amount: amount(input.amount),
      unallocatedAmount: amount(input.amount),
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
      amount(input.amount),
    );
    if (paid.eq(request.amount))
      await tx.paymentRequest.update({
        where: { id: request.id },
        data: { status: "PAID" },
      });
    await audit(tx, ctx, "PaymentRequest", request.id, "PAYMENT");
  }
  await audit(tx, ctx, "Payment", row.id, "CREATE");
  return row;
}
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
}
