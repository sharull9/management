import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Decimal } from "@/core/decimal";
import { invoiceDetail } from "../../server/queries";
import { InvoiceEdit } from "../components/invoice-edit";
import { InvoiceSubmit } from "../components/invoice-submit";

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
  const base = d.ctx.org.baseCurrency;
  const foreign = r.currency !== base;
  // Receipts gain when more base currency arrived than the invoice carried.
  const fx = r.allocations.reduce(
    (v, a) => v.add(a.fxDifference),
    new Decimal(0),
  );
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
        {foreign && (
          <p>
            Exchange rate: 1 {r.currency} = {r.exchangeRate.toString()} {base}
          </p>
        )}
        <p>Place of supply: {r.placeOfSupply?.name ?? "Unspecified"}</p>
        <Table className="text-left">
          <TableHeader>
            <TableRow>
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
                <TableHead className="p-2" key={h}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.lines.map((l) => (
              <TableRow className="border-t" key={l.id}>
                <TableCell className="whitespace-normal">
                  {l.description || l.variant?.name}
                  {l.fromProjectStock && (
                    <span className="sales-no-print block text-xs">
                      Project stock
                      {l.stockMovementId ? " posted" : " on approval"}
                    </span>
                  )}
                </TableCell>
                <TableCell>{l.qty.toString()}</TableCell>
                <TableCell>{l.uom.code}</TableCell>
                <TableCell>{l.rate.toString()}</TableCell>
                <TableCell>{l.discountPercent.toString()}</TableCell>
                <TableCell>{l.lineSubtotal.toFixed(2)}</TableCell>
                <TableCell>{l.lineTax.toFixed(2)}</TableCell>
                <TableCell>{l.lineTotal.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
        {foreign && (
          <dl className="grid grid-cols-2 gap-2">
            {(
              [
                ["Subtotal", r.baseSubtotal],
                ["Tax", r.baseTaxTotal],
                ["Grand total", r.baseGrandTotal],
                ["Payable", r.basePayableTotal],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">
                  {label} ({base})
                </dt>
                <dd>
                  {base} {value.toFixed(2)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p>{r.notes}</p>
      </article>
      <p className="sales-no-print text-sm">
        Use your browser's Print command to print or save this invoice as a PDF.
      </p>
      <div className="sales-no-print space-y-6">
        {r.status === "DRAFT" && writable && (
          <>
            <FormCard title="Submit for approval">
              <InvoiceSubmit org={org} id={r.id} />
            </FormCard>
            <InvoiceEdit org={org} invoiceId={invoiceId} />
          </>
        )}
        <ApprovalTimeline org={org} approvals={d.approvals} variant="sales" />
        <FormCard title="Allocated receipts">
          <ItemGroup>
            {r.allocations.map((a) => (
              <Item key={a.id} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    {a.payment.code} ·{" "}
                    {a.payment.date.toISOString().slice(0, 10)} ·{" "}
                    {a.payment.mode} · {a.payment.reference} · {r.currency}{" "}
                    {a.amount.toFixed(2)} · {base} {a.baseAmount.toFixed(2)}{" "}
                    received vs {a.documentBaseAmount.toFixed(2)} invoiced ·{" "}
                    {a.fxDifference.isZero()
                      ? "no FX"
                      : `${a.fxDifference.gt(0) ? "gain" : "loss"} ${base} ${a.fxDifference.abs().toFixed(2)}`}
                  </ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
          {!r.allocations.length && (
            <EmptyState title="No receipts allocated." />
          )}
          {r.allocations.length > 0 && !fx.isZero() && (
            <p className="text-sm text-muted-foreground">
              Realised FX {fx.gt(0) ? "gain" : "loss"}: {base}{" "}
              {fx.abs().toFixed(2)}
            </p>
          )}
        </FormCard>
      </div>
      <style>{`@media print { body * { visibility: hidden; } .sales-print-invoice, .sales-print-invoice * { visibility: visible; } .sales-print-invoice { position: absolute; left: 0; top: 0; width: 100%; border: 0; padding: 0; color: black; background: white; } .sales-no-print { display: none !important; } .sales-print-invoice table { font-size: 10pt; } .sales-print-invoice tr { break-inside: avoid; } @page { size: A4; margin: 15mm; } }`}</style>
    </>
  );
}
