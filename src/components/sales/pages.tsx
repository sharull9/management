import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import { assertPermission, requireProjectContext } from "@/server/context";
import { Decimal } from "@/server/procurement/calculations";
import { submitInvoiceAction } from "@/server/sales/actions";
import { isInvoiceOverdue } from "@/server/sales/calculations";
import { invoiceDetail, salesData } from "@/server/sales/queries";
import { InvoiceForm, type InvoiceFormData } from "./invoice-form";

type Data = Awaited<ReturnType<typeof salesData>>;
function formData(d: Data): InvoiceFormData {
  return {
    items: d.items,
    orgStateId: d.ctx.org.stateId,
    allowOrgInvoices:
      d.ctx.isAdmin || d.ctx.permissions.has("sales.invoice.create"),
    projects: d.projects.map((p) => ({
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
export async function InvoiceNew({
  org,
  projectId,
}: {
  org: string;
  projectId?: string;
}) {
  const d = await salesData(org, projectId, "sales.invoice.create");
  if (!projectId && !d.projects.length)
    assertPermission(d.ctx, "sales.invoice.create");
  return (
    <>
      <PageHeading
        title="New sales invoice"
        description="Customer billing for goods and services."
      />
      <FormCard title="Draft invoice">
        <InvoiceForm org={org} data={formData(d)} initial={{ projectId }} />
      </FormCard>
    </>
  );
}
export async function InvoiceList({
  org,
  filters,
}: {
  org: string;
  filters: Record<string, string | undefined>;
}) {
  const d = await salesData(org, filters.projectId);
  const rows = d.invoices.filter(
    (r) =>
      (!filters.customerId || r.partyId === filters.customerId) &&
      (!filters.status || r.status === filters.status) &&
      (filters.overdue !== "1" ||
        isInvoiceOverdue(
          {
            status: r.status,
            dueDate: r.dueDate,
            payableTotal: r.payableTotal.toString(),
            receivedTotal: r.receivedTotal.toString(),
          },
          new Date(),
        )),
  );
  const billing = rows.filter((r) =>
    ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(r.status),
  );
  const currencies = [...new Set(billing.map((r) => r.currency))];
  return (
    <>
      <PageHeading
        title="Sales invoices"
        description="Track customer billing, approvals and balances."
      />
      <Link
        className="underline"
        href={`/${org}/sales/invoices/new${filters.projectId ? `?projectId=${filters.projectId}` : ""}`}
      >
        New invoice
      </Link>
      <FormCard title="Filters">
        <form className="flex flex-wrap gap-4">
          <label>
            Customer
            <select
              name="customerId"
              defaultValue={filters.customerId ?? ""}
              className="block rounded border p-2"
            >
              <option value="">All customers</option>
              {d.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Project
            <select
              name="projectId"
              defaultValue={filters.projectId ?? ""}
              className="block rounded border p-2"
            >
              <option value="">All projects</option>
              {d.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="block rounded border p-2"
            >
              <option value="">All statuses</option>
              {[
                "DRAFT",
                "PENDING_APPROVAL",
                "APPROVED",
                "PARTIALLY_PAID",
                "PAID",
                "CANCELLED",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="overdue"
              value="1"
              defaultChecked={filters.overdue === "1"}
            />
            Overdue
          </label>
          <button type="submit" className="rounded border px-4">
            Apply
          </button>
        </form>
      </FormCard>
      {filters.projectId && (
        <FormCard title="Project billing">
          <p className="text-sm">
            Approved invoices in the current filters, grouped by currency.
          </p>
          {currencies.map((currency) => {
            const invoices = billing.filter((r) => r.currency === currency);
            const payable = invoices.reduce(
              (a, r) => a.add(r.payableTotal),
              new Decimal(0),
            );
            const received = invoices.reduce(
              (a, r) => a.add(r.receivedTotal),
              new Decimal(0),
            );
            return (
              <p key={currency}>
                {currency}: billed {payable.toFixed(2)} · received{" "}
                {received.toFixed(2)} · balance{" "}
                {payable.sub(received).toFixed(2)}
              </p>
            );
          })}
        </FormCard>
      )}
      <FormCard title="Invoices">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Code",
                  "Customer",
                  "Project",
                  "Date",
                  "Due",
                  "Grand total",
                  "Received",
                  "Balance",
                  "Status",
                ].map((h) => (
                  <th className="p-2" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr className="border-t" key={r.id}>
                  <td className="p-2">
                    <Link
                      className="underline"
                      href={`/${org}/sales/invoices/${r.id}`}
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="p-2">{r.party.displayName}</td>
                  <td className="p-2">{r.project?.name ?? "—"}</td>
                  <td className="p-2">{r.date.toISOString().slice(0, 10)}</td>
                  <td className="p-2">
                    {r.dueDate?.toISOString().slice(0, 10) ?? "—"}
                  </td>
                  <td className="p-2">
                    {r.currency} {r.grandTotal.toFixed(2)}
                  </td>
                  <td className="p-2">{r.receivedTotal.toFixed(2)}</td>
                  <td className="p-2">
                    {r.payableTotal.sub(r.receivedTotal).toFixed(2)}
                  </td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p>No invoices match these filters.</p>}
      </FormCard>
    </>
  );
}
export async function InvoiceDetail({
  org,
  invoiceId,
}: {
  org: string;
  invoiceId: string;
}) {
  const d = await invoiceDetail(org, invoiceId),
    r = d.row;
  const writable =
    d.ctx.isAdmin || d.ctx.permissions.has("sales.invoice.create");
  const address = r.party.addresses[0];
  return (
    <>
      <div className="sales-no-print">
        <PageHeading
          title={r.code}
          description={`${r.status} · ${r.project?.name ?? "Customer billing"}`}
        />
      </div>
      <article className="sales-print-invoice space-y-5 rounded border p-6">
        <h1 className="text-xl font-semibold">
          {d.ctx.org.legalName ?? d.ctx.org.name}
        </h1>
        <p>
          {d.taxIdentifiers.map((t) => `${t.label}: ${t.value}`).join(" · ")}
        </p>
        <h2 className="text-lg font-semibold">Invoice {r.code}</h2>
        <p>
          {r.status} · {r.currency} · Date {r.date.toISOString().slice(0, 10)} ·
          Due {r.dueDate?.toISOString().slice(0, 10) ?? "—"}
        </p>
        <div>
          <h3 className="font-medium">Bill to: {r.party.legalName}</h3>
          <p>
            {[
              address?.addressLine1,
              address?.addressLine2,
              address?.city?.name,
              address?.state?.name,
              address?.postalCode,
              address?.country?.name,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p>
            {r.party.taxIdentifiers
              .map((t) => `${t.label}: ${t.value}`)
              .join(" · ")}
          </p>
        </div>
        <p>Place of supply: {r.placeOfSupply?.name ?? "Unspecified"}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Description",
                  "Qty",
                  "Unit",
                  "Rate",
                  "Discount %",
                  "Taxable",
                  "Tax",
                  "Total",
                ].map((h) => (
                  <th className="p-2" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr className="border-t" key={l.id}>
                  <td className="p-2">
                    {l.description || l.variant?.name}
                    {l.fromProjectStock && (
                      <span className="sales-no-print block text-xs">
                        Project stock
                        {l.stockMovementId ? " posted" : " on approval"}
                      </span>
                    )}
                  </td>
                  <td className="p-2">{l.qty.toString()}</td>
                  <td className="p-2">{l.uom.code}</td>
                  <td className="p-2">{l.rate.toString()}</td>
                  <td className="p-2">{l.discountPercent.toString()}</td>
                  <td className="p-2">{l.lineSubtotal.toFixed(2)}</td>
                  <td className="p-2">{l.lineTax.toFixed(2)}</td>
                  <td className="p-2">{l.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-medium">Tax breakdown</h3>
          {r.lines.flatMap((l) =>
            l.taxes.map((t) => (
              <p key={t.id} className="text-sm">
                {l.description || l.variant?.name}: {t.name} {t.rate.toString()}
                % · {t.amount.toFixed(2)}
                {t.isWithholding ? " (withholding)" : ""}
              </p>
            )),
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {(
            [
              ["Subtotal", r.subtotal],
              ["Discount", r.discountTotal],
              ["Tax", r.taxTotal],
              ["Withholding", r.withholdingTotal],
              ["Grand total", r.grandTotal],
              ["Payable", r.payableTotal],
              ["Received", r.receivedTotal],
              ["Balance", r.payableTotal.sub(r.receivedTotal)],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd>
                {r.currency} {value.toFixed(2)}
              </dd>
            </div>
          ))}
        </dl>
        <p>{r.notes}</p>
      </article>
      <p className="sales-no-print text-sm">
        Use your browser's Print command to print or save this invoice as a PDF.
      </p>
      <div className="sales-no-print space-y-6">
        {r.status === "DRAFT" && writable && (
          <>
            <FormCard title="Submit for approval">
              <ActionForm
                action={submitInvoiceAction.bind(null, org)}
                submit="Submit"
              >
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            </FormCard>
            <InvoiceEdit org={org} invoiceId={invoiceId} />
          </>
        )}
        <FormCard title="Approval timeline">
          {d.approvals.map((a) => (
            <div key={a.id} className="mb-4">
              <p>
                {a.createdAt.toISOString().slice(0, 10)} · {a.status}
              </p>
              {a.steps.map((s) => (
                <p className="text-sm" key={s.id}>
                  {s.sequence}. {s.name} · {s.status} ·{" "}
                  {s.actedBy?.name ?? "Awaiting action"} {s.comment}
                </p>
              ))}
            </div>
          ))}
          {!d.approvals.length && <p>Not submitted.</p>}
        </FormCard>
        <FormCard title="Allocated receipts">
          {r.allocations.map((a) => (
            <p key={a.id}>
              {a.payment.code} · {a.payment.date.toISOString().slice(0, 10)} ·{" "}
              {a.payment.mode} · {a.payment.reference} · {r.currency}{" "}
              {a.amount.toFixed(2)}
            </p>
          ))}
          {!r.allocations.length && <p>No receipts allocated.</p>}
        </FormCard>
      </div>
      <style>{`@media print { body * { visibility: hidden; } .sales-print-invoice, .sales-print-invoice * { visibility: visible; } .sales-print-invoice { position: absolute; left: 0; top: 0; width: 100%; border: 0; padding: 0; color: black; background: white; } .sales-no-print { display: none !important; } .sales-print-invoice table { font-size: 10pt; } .sales-print-invoice tr { break-inside: avoid; } @page { size: A4; margin: 15mm; } }`}</style>
    </>
  );
}
async function InvoiceEdit({
  org,
  invoiceId,
}: {
  org: string;
  invoiceId: string;
}) {
  const { row: r } = await invoiceDetail(org, invoiceId);
  if (r.projectId)
    assertPermission(
      await requireProjectContext(org, r.projectId),
      "sales.invoice.create",
    );
  const d = await salesData(org, undefined, "sales.invoice.create");
  return (
    <FormCard title="Edit draft">
      <InvoiceForm
        org={org}
        data={formData(d)}
        initial={{
          id: r.id,
          projectId: r.projectId,
          partyId: r.partyId,
          date: r.date.toISOString().slice(0, 10),
          dueDate: r.dueDate?.toISOString().slice(0, 10),
          stateId: r.stateId,
          notes: r.notes ?? "",
          lines: r.lines.map((l) => ({
            itemId: l.variant?.itemId ?? null,
            levels: l.variant
              ? [
                  l.variant.level1Id,
                  l.variant.level2Id,
                  l.variant.level3Id,
                  l.variant.level4Id,
                  l.variant.level5Id,
                ]
              : [],
            description: l.description,
            qty: l.qty.toString(),
            uomId: l.uomId,
            rate: l.rate.toString(),
            discountPercent: l.discountPercent.toString(),
            taxGroupId: l.taxGroupId,
            fromProjectStock: l.fromProjectStock,
          })),
        }}
      />
    </FormCard>
  );
}
