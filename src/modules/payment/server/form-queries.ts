import "server-only";
import { db } from "@/core/db";
import { Decimal } from "@/core/decimal";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import type { FormData } from "../type";
import { settledStatuses } from "./allocation";
import { financeScope } from "./finance-scope";

export async function paymentFormData(
  org: string,
  requestId?: string,
  projectId?: string,
): Promise<FormData> {
  const scope = await financeScope(org, "payment.record", projectId);
  const [projects, parties, bills, candidates, selectedRequest, baseCurrency] =
    await Promise.all([
      db.project.findMany({
        where: {
          ...moduleProjectWhere(scope.ctx, "payment.record"),
          ...(scope.ids.length ? { id: { in: scope.ids } } : {}),
        },
        select: { id: true, name: true, code: true, currency: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      db.party.findMany({
        where: {
          tenantId: scope.ctx.tenant.id,
          OR: [{ isVendor: true }, { isCustomer: true }],
        },
        select: {
          id: true,
          displayName: true,
          isVendor: true,
          isCustomer: true,
        },
        orderBy: { displayName: "asc" },
        take: 50,
      }),
      db.vendorBill.findMany({
        where: {
          organizationId: scope.ctx.org.id,
          projectId: projectId ?? { in: scope.ids },
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
      }),
      db.paymentRequest.findMany({
        where: { ...scope.scopedWhere, status: "APPROVED" },
        select: {
          id: true,
          code: true,
          partyId: true,
          projectId: true,
          currency: true,
          mode: true,
          amount: true,
          payments: { where: { status: "POSTED" }, select: { amount: true } },
        },
        orderBy: { date: "desc" },
        take: 50,
      }),
      requestId
        ? db.paymentRequest.findFirst({
            where: { ...scope.scopedWhere, id: requestId, status: "APPROVED" },
            select: {
              id: true,
              code: true,
              partyId: true,
              projectId: true,
              currency: true,
              mode: true,
              amount: true,
              payments: {
                where: { status: "POSTED" },
                select: { amount: true },
              },
            },
          })
        : null,
      db.currency.findUniqueOrThrow({
        where: { code: scope.ctx.org.baseCurrency },
        select: { code: true, decimals: true },
      }),
    ]);
  const requests = [...candidates];
  if (
    selectedRequest &&
    !requests.some((item) => item.id === selectedRequest.id)
  )
    requests.unshift(selectedRequest);
  const [selectedProject, selectedParty] = selectedRequest
    ? await Promise.all([
        selectedRequest.projectId
          ? db.project.findFirst({
              where: {
                id: selectedRequest.projectId,
                ...moduleProjectWhere(scope.ctx, "payment.record"),
              },
              select: { id: true, name: true, code: true, currency: true },
            })
          : null,
        db.party.findFirst({
          where: { id: selectedRequest.partyId, tenantId: scope.ctx.tenant.id },
          select: {
            id: true,
            displayName: true,
            isVendor: true,
            isCustomer: true,
          },
        }),
      ])
    : [null, null];
  const visibleProjects =
    selectedProject && !projects.some((p) => p.id === selectedProject.id)
      ? [selectedProject, ...projects]
      : projects;
  const visibleParties =
    selectedParty && !parties.some((p) => p.id === selectedParty.id)
      ? [selectedParty, ...parties]
      : parties;
  return {
    baseCurrency: baseCurrency.code,
    allowOrganization: scope.global && !("project" in scope.ctx),
    projects: visibleProjects.map((p) => ({
      id: p.id,
      name: `${p.code} · ${p.name}`,
      currency: p.currency,
    })),
    parties: visibleParties.map((p) => ({
      id: p.id,
      name: p.displayName,
      isVendor: p.isVendor,
      isCustomer: p.isCustomer,
    })),
    bills: bills.map((b) => ({
      id: b.id,
      code: b.code,
      partyId: b.partyId,
      projectId: b.projectId,
      currency: b.currency,
      outstanding: b.payableTotal.sub(b.paidTotal).toFixed(2),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      code: r.code,
      partyId: r.partyId,
      projectId: r.projectId,
      currency: r.currency,
      mode: r.mode,
      remaining: r.amount
        .sub(
          r.payments.reduce(
            (sum, payment) => sum.add(payment.amount),
            new Decimal(0),
          ),
        )
        .toFixed(2),
    })),
  };
}

export async function requestFormData(
  org: string,
  requestId?: string,
  projectId?: string,
) {
  const scope = await financeScope(org, "payment.request.create", projectId);
  const [projects, parties, bills, draft, baseCurrency] = await Promise.all([
    db.project.findMany({
      where: {
        ...moduleProjectWhere(scope.ctx, "payment.request.create"),
        ...(scope.ids.length ? { id: { in: scope.ids } } : {}),
      },
      select: { id: true, name: true, code: true, currency: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    db.party.findMany({
      where: { tenantId: scope.ctx.tenant.id, isVendor: true },
      select: { id: true, displayName: true, isVendor: true, isCustomer: true },
      orderBy: { displayName: "asc" },
      take: 50,
    }),
    db.vendorBill.findMany({
      where: {
        organizationId: scope.ctx.org.id,
        projectId: projectId ?? { in: scope.ids },
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
    }),
    requestId
      ? db.paymentRequest.findFirst({
          where: { ...scope.scopedWhere, id: requestId, status: "DRAFT" },
          include: {
            bills: {
              include: {
                bill: {
                  select: {
                    id: true,
                    code: true,
                    partyId: true,
                    projectId: true,
                    currency: true,
                    payableTotal: true,
                    paidTotal: true,
                  },
                },
              },
            },
          },
        })
      : null,
    db.currency.findUniqueOrThrow({
      where: { code: scope.ctx.org.baseCurrency },
      select: { code: true, decimals: true },
    }),
  ]);
  const draftBills =
    draft?.bills.map(({ bill }) => ({
      id: bill.id,
      code: bill.code,
      partyId: bill.partyId,
      projectId: bill.projectId,
      currency: bill.currency,
      outstanding: bill.payableTotal.sub(bill.paidTotal).toFixed(2),
    })) ?? [];
  const uniqueBills = [
    ...draftBills,
    ...bills.map((b) => ({
      id: b.id,
      code: b.code,
      partyId: b.partyId,
      projectId: b.projectId,
      currency: b.currency,
      outstanding: b.payableTotal.sub(b.paidTotal).toFixed(2),
    })),
  ].filter(
    (b, index, all) =>
      all.findIndex((candidate) => candidate.id === b.id) === index,
  );
  const [selectedProject, selectedParty] = draft
    ? await Promise.all([
        draft.projectId
          ? db.project.findFirst({
              where: {
                id: draft.projectId,
                ...moduleProjectWhere(scope.ctx, "payment.request.create"),
              },
              select: { id: true, name: true, code: true, currency: true },
            })
          : null,
        db.party.findFirst({
          where: {
            id: draft.partyId,
            tenantId: scope.ctx.tenant.id,
            isVendor: true,
          },
          select: {
            id: true,
            displayName: true,
            isVendor: true,
            isCustomer: true,
          },
        }),
      ])
    : [null, null];
  const visibleProjects =
    selectedProject && !projects.some((p) => p.id === selectedProject.id)
      ? [selectedProject, ...projects]
      : projects;
  const visibleParties =
    selectedParty && !parties.some((p) => p.id === selectedParty.id)
      ? [selectedParty, ...parties]
      : parties;
  return {
    ctx: scope.ctx,
    data: {
      baseCurrency: baseCurrency.code,
      allowOrganization: scope.global && !("project" in scope.ctx),
      projects: visibleProjects.map((p) => ({
        id: p.id,
        name: `${p.code} · ${p.name}`,
        currency: p.currency,
      })),
      parties: visibleParties.map((p) => ({
        id: p.id,
        name: p.displayName,
        isVendor: p.isVendor,
        isCustomer: p.isCustomer,
      })),
      bills: uniqueBills,
      requests: [],
    } satisfies FormData,
    draft,
  };
}
