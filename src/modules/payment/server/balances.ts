import "server-only";
import { parseMultiParam } from "@/components/shared/filter-bar/multi-param";
import { agingBucket, Decimal } from "./allocation";

import type { FinanceData } from "./queries";
export function partyBalances(d: FinanceData, partyId?: string, type?: string) {
  const types = parseMultiParam(type).filter(
    (t) => t === "vendor" || t === "customer",
  );
  return d.parties
    .filter(
      (p) =>
        (!partyId || p.id === partyId) &&
        (!types.length ||
          (types.includes("vendor") && p.isVendor) ||
          (types.includes("customer") && p.isCustomer)),
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
