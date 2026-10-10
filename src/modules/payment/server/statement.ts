import "server-only";
import { Decimal, runningBalance, type StatementEntry } from "./allocation";

import type { FinanceData } from "./queries";
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
