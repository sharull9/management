import "server-only";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "../context";
import { db } from "../db";
import { moduleProjectWhere } from "../procurement/queries";
import {
  agingBucket,
  Decimal,
  runningBalance,
  type StatementEntry,
  settledStatuses,
} from "./allocation";

export async function financeData(
  org: string,
  permission = "payment.view",
  projectId?: string,
) {
  const orgCtx = await requireOrgContext(org);
  const ctx = projectId ? await requireProjectContext(org, projectId) : orgCtx;
  const canViewOrg = orgCtx.isAdmin || orgCtx.permissions.has(permission);
  const global = ctx.isAdmin || ctx.permissions.has(permission);
  if (projectId) assertPermission(ctx, permission);
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, permission),
    orderBy: { name: "asc" },
  });
  const ids = projects.map((p) => p.id);
  if (!global && !ids.length) assertPermission(ctx, permission);
  if (projectId && !ids.includes(projectId))
    throw new Error("Project is not accessible.");
  const where = {
    organizationId: ctx.org.id,
    ...(projectId
      ? { projectId }
      : {
          OR: [
            ...(global ? [{ projectId: null }] : []),
            { projectId: { in: ids } },
          ],
        }),
  };
  const [parties, requests, payments, bills, invoices] = await Promise.all([
    db.party.findMany({
      where: {
        tenantId: ctx.tenant.id,
        OR: [{ isVendor: true }, { isCustomer: true }],
      },
      orderBy: { displayName: "asc" },
    }),
    db.paymentRequest.findMany({
      where,
      include: {
        party: true,
        bills: true,
        payments: { where: { status: "POSTED" } },
      },
      orderBy: { date: "desc" },
    }),
    db.payment.findMany({
      where: projectId
        ? {
            organizationId: ctx.org.id,
            OR: [
              { projectId },
              {
                allocations: {
                  some: {
                    OR: [
                      { vendorBill: { projectId } },
                      { salesInvoice: { projectId } },
                    ],
                  },
                },
              },
            ],
          }
        : !canViewOrg
          ? {
              organizationId: ctx.org.id,
              OR: [
                { projectId: { in: ids } },
                {
                  allocations: {
                    some: {
                      OR: [
                        { vendorBill: { projectId: { in: ids } } },
                        { salesInvoice: { projectId: { in: ids } } },
                      ],
                    },
                  },
                },
              ],
            }
          : where,
      include: {
        party: true,
        allocations: { include: { vendorBill: true, salesInvoice: true } },
      },
      orderBy: { date: "desc" },
    }),
    db.vendorBill.findMany({
      where: {
        organizationId: ctx.org.id,
        projectId: projectId ?? { in: ids },
        status: { in: [...settledStatuses] },
      },
      orderBy: { date: "asc" },
    }),
    db.salesInvoice.findMany({
      where: { ...where, status: { in: [...settledStatuses] } },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    ctx,
    projects,
    parties,
    requests,
    payments,
    bills,
    invoices,
    projectId,
    allowOrganization: global && !("project" in ctx),
    canViewOrg,
  };
}
export type FinanceData = Awaited<ReturnType<typeof financeData>>;
export function partyBalances(d: FinanceData, partyId?: string, type?: string) {
  return d.parties
    .filter(
      (p) =>
        (!partyId || p.id === partyId) &&
        (type === "vendor"
          ? p.isVendor
          : type === "customer"
            ? p.isCustomer
            : true),
    )
    .flatMap((party) => {
      const bills = d.bills.filter((b) => b.partyId === party.id),
        invoices = d.invoices.filter((i) => i.partyId === party.id),
        payments = d.payments.filter(
          (p) => p.partyId === party.id && p.status === "POSTED",
        );
      const currencies = new Set(
        [...bills, ...invoices, ...payments].map((r) => r.currency),
      );
      return [...currencies].map((currency) => {
        const sum = (values: { toString(): string }[]) =>
          values.reduce<InstanceType<typeof Decimal>>(
            (v, n) => v.add(n.toString()),
            new Decimal(0),
          );
        const vb = bills.filter((b) => b.currency === currency),
          si = invoices.filter((i) => i.currency === currency),
          pay = payments.filter((p) => p.currency === currency);
        const billed = sum(vb.map((b) => b.payableTotal)),
          paid = sum(vb.map((b) => b.paidTotal)),
          invoiced = sum(si.map((i) => i.payableTotal)),
          received = sum(si.map((i) => i.receivedTotal));
        const outgoingAdvance = sum(
            pay
              .filter(
                (p) =>
                  p.direction === "OUTGOING" &&
                  (!d.projectId || p.projectId === d.projectId) &&
                  (d.canViewOrg || p.projectId !== null),
              )
              .map((p) => p.unallocatedAmount),
          ),
          incomingAdvance = sum(
            pay
              .filter(
                (p) =>
                  p.direction === "INCOMING" &&
                  (!d.projectId || p.projectId === d.projectId) &&
                  (d.canViewOrg || p.projectId !== null),
              )
              .map((p) => p.unallocatedAmount),
          );
        const aging = {
          current: new Decimal(0),
          "0–30": new Decimal(0),
          "31–60": new Decimal(0),
          "61–90": new Decimal(0),
          "90+": new Decimal(0),
        };
        const receivableAging = { ...aging },
          payableAging = { ...aging };
        const asOf = new Date();
        for (const b of vb) {
          const bucket = agingBucket(b.dueDate, asOf);
          payableAging[bucket] = payableAging[bucket].add(
            b.payableTotal.sub(b.paidTotal),
          );
        }
        for (const i of si) {
          const bucket = agingBucket(i.dueDate, asOf);
          receivableAging[bucket] = receivableAging[bucket].add(
            i.payableTotal.sub(i.receivedTotal),
          );
        }
        return {
          party,
          currency,
          billed,
          paid,
          invoiced,
          received,
          payable: billed.sub(paid),
          receivable: invoiced.sub(received),
          outgoingAdvance,
          incomingAdvance,
          net: invoiced
            .sub(received)
            .sub(billed.sub(paid))
            .add(outgoingAdvance)
            .sub(incomingAdvance),
          payableAging,
          receivableAging,
        };
      });
    });
}
export function partyStatement(
  d: FinanceData,
  partyId: string,
  currency: string,
) {
  const entries: StatementEntry[] = [];
  for (const b of d.bills.filter(
    (b) => b.partyId === partyId && b.currency === currency,
  ))
    entries.push({
      id: b.id,
      date: b.date,
      description: `${b.code} · Vendor bill`,
      debit: "0",
      credit: b.payableTotal,
      order: 0,
    });
  for (const i of d.invoices.filter(
    (i) => i.partyId === partyId && i.currency === currency,
  ))
    entries.push({
      id: i.id,
      date: i.date,
      description: `${i.code} · Sales invoice`,
      debit: i.payableTotal,
      credit: "0",
      order: 0,
    });
  for (const p of d.payments.filter(
    (p) => p.partyId === partyId && p.currency === currency,
  )) {
    const visibleIds = d.projects.map((p) => p.id);
    const allocations = p.allocations.filter((a) => {
      const project = a.vendorBill?.projectId ?? a.salesInvoice?.projectId;
      return d.projectId
        ? project === d.projectId
        : d.canViewOrg ||
            (project !== null &&
              project !== undefined &&
              visibleIds.includes(project));
    });
    const scoped = d.projectId
      ? p.projectId !== d.projectId
      : !d.canViewOrg && (!p.projectId || !visibleIds.includes(p.projectId));
    const value = scoped
      ? allocations.reduce((v, a) => v.add(a.amount), new Decimal(0))
      : p.amount;
    if (!scoped)
      entries.push({
        id: p.id,
        date: p.date,
        description: `${p.code} · ${p.direction} payment`,
        debit: p.direction === "OUTGOING" ? value : "0",
        credit: p.direction === "INCOMING" ? value : "0",
        order: 1,
      });
    if (p.status === "VOID")
      entries.push({
        id: `${p.id}:void`,
        date: p.updatedAt,
        description: `${p.code} · Void reversal`,
        debit: p.direction === "INCOMING" ? value : "0",
        credit: p.direction === "OUTGOING" ? value : "0",
        order: 3,
      });
    for (const a of allocations)
      entries.push({
        id: a.id,
        date: a.allocatedAt,
        description: `${p.code} · Allocated ${a.amount.toFixed(2)} to ${a.vendorBill?.code ?? a.salesInvoice?.code}${p.status === "VOID" ? " (reversed)" : ""}`,
        debit: scoped && p.direction === "OUTGOING" ? a.amount : "0",
        credit: scoped && p.direction === "INCOMING" ? a.amount : "0",
        order: 2,
      });
  }
  return runningBalance(entries);
}
