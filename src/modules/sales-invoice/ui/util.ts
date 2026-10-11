import type { salesData } from "../server/queries";
import type { InvoiceFormData } from "../type";

type Data = Awaited<ReturnType<typeof salesData>>;
export function formData(d: Data, projectId?: string | null): InvoiceFormData {
  return {
    items: d.items,
    orgStateId: d.ctx.org.stateId,
    allowOrgInvoices:
      d.ctx.isAdmin || d.ctx.permissions.has("sales.invoice.create"),
    projects: d.projects
      .filter(
        (project) =>
          project.id === projectId ||
          (!(d.ctx.isAdmin || d.ctx.permissions.has("sales.invoice.create")) &&
            project.id === d.projects[0]?.id),
      )
      .map((p) => ({
        id: p.id,
        name: `${p.code} · ${p.name}`,
        clientPartyId: p.clientPartyId,
      })),
    customers: d.customers.map((p) => ({
      id: p.id,
      name: p.displayName,
      stateId: p.addresses[0]?.stateId ?? null,
      paymentTerms: p.paymentTerms,
    })),
    uoms: d.uoms.map((u) => ({ id: u.id, name: `${u.code} · ${u.name}` })),
    states: d.states.map((s) => ({ id: s.id, name: s.name })),
    groups: d.groups.map((g) => ({
      id: g.id,
      name: g.name,
      scope: g.scope,
      components: g.components.map((c) => ({
        id: c.component.id,
        name: c.component.name,
        rate: c.component.rate.toString(),
        isWithholding: c.component.isWithholding,
        appliesTo: c.component.appliesTo,
      })),
    })),
  };
}
