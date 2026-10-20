import "server-only";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { activeFxTotal, settledStatuses } from "./allocation";
import { financeScope, visiblePaymentRow } from "./finance-scope";

export async function requestDetailData(org: string, id: string) {
  const scope = await financeScope(org, "payment.view");
  const [request, baseCurrency] = await Promise.all([
    db.paymentRequest.findFirst({
      where: { ...scope.scopedWhere, id },
      include: {
        party: true,
        project: { select: { id: true, name: true } },
        bills: {
          where: { bill: { projectId: { in: scope.ids } } },
          include: {
            bill: { select: { id: true, code: true, projectId: true } },
          },
        },
        payments: {
          where: { status: "POSTED" },
          select: { id: true, code: true, amount: true },
        },
      },
    }),
    db.currency.findUniqueOrThrow({
      where: { code: scope.ctx.org.baseCurrency },
      select: { code: true, decimals: true },
    }),
  ]);
  return { ctx: scope.ctx, request, baseCurrency };
}

export async function paymentDetailData(
  org: string,
  id: string,
  permission = "payment.view",
) {
  const scope = await financeScope(org, permission);
  const visibility = scope.canViewOrg
    ? scope.scopedWhere
    : {
        organizationId: scope.ctx.org.id,
        OR: [
          { projectId: { in: scope.ids } },
          {
            allocations: {
              some: {
                OR: [
                  { vendorBill: { projectId: { in: scope.ids } } },
                  { salesInvoice: { projectId: { in: scope.ids } } },
                ],
              },
            },
          },
        ],
      };
  const payment = await db.payment.findFirst({
    where: { ...visibility, id },
    include: {
      party: true,
      project: { select: { id: true, name: true } },
      allocations: {
        where: scope.canViewOrg
          ? {}
          : {
              OR: [
                { vendorBill: { projectId: { in: scope.ids } } },
                { salesInvoice: { projectId: { in: scope.ids } } },
              ],
            },
        include: {
          vendorBill: { select: { id: true, code: true, projectId: true } },
          salesInvoice: { select: { id: true, code: true, projectId: true } },
        },
        orderBy: { allocatedAt: "asc" },
      },
    },
  });
  if (!payment)
    return {
      ...scope,
      payment,
      baseCurrency: { code: scope.ctx.org.baseCurrency },
    };
  const visibleProject =
    !payment.projectId ||
    scope.canViewOrg ||
    scope.ids.includes(payment.projectId);
  if (payment.projectId && visibleProject) {
    const projectCtx = await requireProjectContext(org, payment.projectId);
    assertPermission(projectCtx, permission);
  } else if (!scope.canViewOrg && !payment.allocations.length) {
    throw new UserFacingError("Payment is not accessible.");
  }
  const documents =
    payment.direction === "OUTGOING"
      ? await db.vendorBill.findMany({
          where: {
            organizationId: scope.ctx.org.id,
            projectId: { in: scope.ids },
            partyId: payment.partyId,
            currency: payment.currency,
            status: { in: [...settledStatuses] },
            payableTotal: { gt: db.vendorBill.fields.paidTotal },
          },
          select: {
            id: true,
            code: true,
            partyId: true,
            projectId: true,
            currency: true,
            payableTotal: true,
            paidTotal: true,
          },
          orderBy: { date: "asc" },
          take: 50,
        })
      : await db.salesInvoice.findMany({
          where: {
            ...scope.scopedWhere,
            partyId: payment.partyId,
            currency: payment.currency,
            status: { in: [...settledStatuses] },
            payableTotal: { gt: db.salesInvoice.fields.receivedTotal },
          },
          select: {
            id: true,
            code: true,
            partyId: true,
            projectId: true,
            currency: true,
            payableTotal: true,
            receivedTotal: true,
          },
          orderBy: { date: "asc" },
          take: 50,
        });
  const [baseCurrency, fxAllocations] = await Promise.all([
    db.currency.findUniqueOrThrow({
      where: { code: scope.ctx.org.baseCurrency },
      select: { code: true, decimals: true },
    }),
    db.paymentAllocation.findMany({
      where: { paymentId: payment.id, organizationId: scope.ctx.org.id },
      select: { fxDifference: true },
    }),
  ]);
  return {
    ...scope,
    payment: visiblePaymentRow(payment, scope),
    baseCurrency,
    realizedFx: activeFxTotal(
      fxAllocations.map((allocation) => ({
        fxDifference: allocation.fxDifference,
        payment: { status: payment.status },
      })),
    ),
    documents: documents.map((document) => ({
      id: document.id,
      code: document.code,
      partyId: document.partyId,
      projectId: document.projectId,
      currency: document.currency,
      outstanding: document.payableTotal
        .sub(
          payment.direction === "OUTGOING"
            ? "paidTotal" in document
              ? document.paidTotal
              : 0
            : "receivedTotal" in document
              ? document.receivedTotal
              : 0,
        )
        .toFixed(2),
    })),
  };
}
