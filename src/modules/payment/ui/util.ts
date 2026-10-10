import { Decimal } from "../server/allocation";
import type { FinanceData } from "../server/queries";
import type { FormData } from "../type";
export const money = (v: { toFixed: (places: number) => string }) =>
  v.toFixed(2);
export const date = (d: Date) => d.toISOString().slice(0, 10);
export const linkClass = "text-sm font-medium underline underline-offset-4";
export function formData(d: FinanceData): FormData {
  return {
    baseCurrency: d.ctx.org.baseCurrency,
    allowOrganization: d.allowOrganization,
    projects: d.projects.map((p) => ({
      id: p.id,
      name: `${p.code} · ${p.name}`,
      currency: p.currency,
    })),
    parties: d.parties.map((p) => ({
      id: p.id,
      name: p.displayName,
      isVendor: p.isVendor,
      isCustomer: p.isCustomer,
    })),
    bills: d.bills
      .filter((b) => b.payableTotal.gt(b.paidTotal))
      .map((b) => ({
        id: b.id,
        code: b.code,
        partyId: b.partyId,
        projectId: b.projectId,
        currency: b.currency,
        outstanding: money(b.payableTotal.sub(b.paidTotal)),
      })),
    requests: d.requests
      .filter((r) => r.status === "APPROVED")
      .map((r) => ({
        id: r.id,
        code: r.code,
        partyId: r.partyId,
        projectId: r.projectId,
        currency: r.currency,
        mode: r.mode,
        remaining: money(
          r.amount.sub(
            r.payments.reduce((v, p) => v.add(p.amount), new Decimal(0)),
          ),
        ),
      })),
  };
}
