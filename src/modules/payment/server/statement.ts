import "server-only";
import { Decimal, runningBalance, type StatementEntry } from "./allocation";

import type { FinanceData } from "./queries";

type BaseValue = { baseDebit: string; baseCredit: string };
export function partyStatement(
  d: FinanceData,
  partyId: string,
  currency: string,
) {
  const entries: StatementEntry[] = [];
  // Base-currency twin of every entry, valued at the document's/payment's rate.
  const base = new Map<string, BaseValue>();
  const add = (entry: StatementEntry, value: BaseValue) => {
    entries.push(entry);
    base.set(entry.id, value);
  };
  const zero = "0";
  for (const b of d.bills.filter(
    (b) => b.partyId === partyId && b.currency === currency,
  ))
    add(
      {
        id: b.id,
        date: b.date,
        description: `${b.code} · Vendor bill`,
        debit: "0",
        credit: b.payableTotal,
        order: 0,
      },
      { baseDebit: zero, baseCredit: b.basePayableTotal.toString() },
    );
  for (const i of d.invoices.filter(
    (i) => i.partyId === partyId && i.currency === currency,
  ))
    add(
      {
        id: i.id,
        date: i.date,
        description: `${i.code} · Sales invoice`,
        debit: i.payableTotal,
        credit: "0",
        order: 0,
      },
      { baseDebit: i.basePayableTotal.toString(), baseCredit: zero },
    );
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
    const baseValue = (
      scoped
        ? allocations.reduce((v, a) => v.add(a.baseAmount), new Decimal(0))
        : p.baseAmount
    ).toString();
    if (!scoped)
      add(
        {
          id: p.id,
          date: p.date,
          description: `${p.code} · ${p.direction} payment`,
          debit: p.direction === "OUTGOING" ? value : "0",
          credit: p.direction === "INCOMING" ? value : "0",
          order: 1,
        },
        {
          baseDebit: p.direction === "OUTGOING" ? baseValue : zero,
          baseCredit: p.direction === "INCOMING" ? baseValue : zero,
        },
      );
    if (p.status === "VOID")
      add(
        {
          id: `${p.id}:void`,
          date: p.updatedAt,
          description: `${p.code} · Void reversal`,
          debit: p.direction === "INCOMING" ? value : "0",
          credit: p.direction === "OUTGOING" ? value : "0",
          order: 3,
        },
        {
          baseDebit: p.direction === "INCOMING" ? baseValue : zero,
          baseCredit: p.direction === "OUTGOING" ? baseValue : zero,
        },
      );
    for (const a of allocations)
      add(
        {
          id: a.id,
          date: a.allocatedAt,
          description: `${p.code} · Allocated ${a.amount.toFixed(2)} to ${a.vendorBill?.code ?? a.salesInvoice?.code}${p.status === "VOID" ? " (reversed)" : ""}`,
          debit: scoped && p.direction === "OUTGOING" ? a.amount : "0",
          credit: scoped && p.direction === "INCOMING" ? a.amount : "0",
          order: 2,
        },
        {
          baseDebit:
            scoped && p.direction === "OUTGOING"
              ? a.baseAmount.toString()
              : zero,
          baseCredit:
            scoped && p.direction === "INCOMING"
              ? a.baseAmount.toString()
              : zero,
        },
      );
  }
  // Same sort keys on the base twin keep both balances aligned row by row.
  const baseBalances = new Map(
    runningBalance(
      entries.map((e) => {
        const v = base.get(e.id) as BaseValue;
        return { ...e, debit: v.baseDebit, credit: v.baseCredit };
      }),
    ).map((e) => [e.id, e.balance]),
  );
  return runningBalance(entries).map((e) => ({
    ...e,
    baseBalance: baseBalances.get(e.id) ?? "0.00",
  }));
}
