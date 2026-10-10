import { ActionForm } from "@/components/shared/action-form";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { submitInvoiceAction } from "../../server/actions";
import { invoiceDetail } from "../../server/queries";
import { InvoiceEdit } from "../components/invoice-edit";

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
        <ApprovalTimeline org={org} approvals={d.approvals} variant="sales" />
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
