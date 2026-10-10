import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { Field } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { attachBillAction, submitBillAction } from "../../server/actions";
import { billDetail, billOptions } from "../../server/queries";
import type { BillDraftLine } from "../../type";
import { BillForm } from "../components/vendor-bill-form";

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
export async function BillDetail({
  org,
  billId,
}: {
  org: string;
  billId: string;
}) {
  const { ctx, row, attachments, approvals } = await billDetail(org, billId);
  const canEdit =
    row.status === "DRAFT" &&
    (ctx.isAdmin || ctx.permissions.has("bill.create"));
  const options = canEdit ? await billOptions(org, row.id) : null;
  const initialLines: BillDraftLine[] = row.lines.map((l) => ({
    poLineId: l.poLineId,
    grnLineId: l.grnLineId,
    itemVariantId: l.itemVariantId,
    description: l.description,
    qty: l.qty.toString(),
    uomId: l.uomId,
    rate: l.rate.toString(),
    discountPercent: l.discountPercent.toString(),
    taxGroupId: l.taxGroupId,
    poRate: l.poRate?.toString() ?? null,
  }));
  return (
    <div className="space-y-6">
      <PageHeading
        title={row.code}
        description={`${row.party.displayName} · ${row.project.name} · ${row.status.replaceAll("_", " ")}`}
      />
      <p className="text-sm">
        Vendor invoice {row.vendorInvoiceNo} dated {day(row.vendorInvoiceDate)}{" "}
        · Bill date {day(row.date)} · Due {day(row.dueDate)} · {row.currency}
      </p>
      {row.notes && <p className="whitespace-pre-wrap text-sm">{row.notes}</p>}
      {row.purchaseOrder && (
        <FormCard title="Linked procurement">
          <Link
            className="underline"
            href={`/${org}/procurement/orders/${row.purchaseOrder.id}`}
          >
            {row.purchaseOrder.code}
          </Link>
          <div className="mt-2 space-y-2">
            {row.purchaseOrder.goodsReceiptRows.map((r) => (
              <p key={r.id}>
                <Link
                  className="underline"
                  href={`/${org}/procurement/receipts/${r.id}`}
                >
                  {r.code}
                </Link>{" "}
                · {r.status}
              </p>
            ))}
          </div>
        </FormCard>
      )}
      <FormCard title="Bill lines">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Description",
                  "Qty",
                  "Unit",
                  "PO rate",
                  "Billed rate",
                  "Discount %",
                  "Variance",
                  "Net",
                  "Tax",
                  "Total",
                  "GRN",
                ].map((h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.description}</td>
                  <td className="p-2">{l.qty.toString()}</td>
                  <td className="p-2">{l.uom.code}</td>
                  <td className="p-2">{l.poRate?.toString() ?? ""}</td>
                  <td className="p-2">{l.rate.toString()}</td>
                  <td className="p-2">{l.discountPercent.toString()}</td>
                  <td className="p-2">{l.varianceAmount.toFixed(2)}</td>
                  <td className="p-2">{l.lineSubtotal.toFixed(2)}</td>
                  <td className="p-2">{l.lineTax.toFixed(2)}</td>
                  <td className="p-2">{l.lineTotal.toFixed(2)}</td>
                  <td className="p-2">
                    {l.grnLine && (
                      <Link
                        className="underline"
                        href={`/${org}/procurement/receipts/${l.grnLine.receiptId}`}
                      >
                        {l.grnLine.receipt.code}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormCard>
      <FormCard title="Tax breakdown and totals">
        <ul className="space-y-2 text-sm">
          {row.lines.flatMap((l) =>
            l.taxes.map((t) => (
              <li key={t.id}>
                {l.description} · {t.name} {t.rate.toString()}%{" "}
                {t.isWithholding ? "(withholding)" : ""}: {t.amount.toFixed(2)}
              </li>
            )),
          )}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt>Subtotal before discount</dt>
          <dd>{row.subtotal.toFixed(2)}</dd>
          <dt>Discount</dt>
          <dd>{row.discountTotal.toFixed(2)}</dd>
          <dt>Tax</dt>
          <dd>{row.taxTotal.toFixed(2)}</dd>
          <dt>Grand total</dt>
          <dd>{row.grandTotal.toFixed(2)}</dd>
          <dt>Withholding</dt>
          <dd>{row.withholdingTotal.toFixed(2)}</dd>
          <dt>Payable</dt>
          <dd>{row.payableTotal.toFixed(2)}</dd>
          <dt>Paid</dt>
          <dd>{row.paidTotal.toFixed(2)}</dd>
          <dt>Balance</dt>
          <dd>
            {row.payableTotal.sub(row.paidTotal).toFixed(2)} {row.currency}
          </dd>
        </dl>
      </FormCard>
      <FormCard title="Vendor invoice attachments">
        <div className="space-y-2">
          {attachments.map((a) => (
            <p key={a.id}>
              <a
                className="underline"
                href={`/${org}/procurement/bills/${row.id}/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {a.filename}
              </a>
            </p>
          ))}
          {!attachments.length && (
            <p className="text-sm text-muted-foreground">No attachments yet.</p>
          )}
        </div>
        {canEdit && (
          <div className="mt-4">
            <ActionForm
              action={attachBillAction.bind(null, org)}
              submit="Attach vendor invoice"
            >
              <input type="hidden" name="id" value={row.id} />
              <Field
                label="Vendor invoice copy (PDF, PNG or JPEG, max 900 KB)"
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                required
              />
            </ActionForm>
          </div>
        )}
      </FormCard>
      <FormCard title="Allocated payments">
        {row.allocations.map((a) => (
          <p className="text-sm" key={a.id}>
            <Link
              className="underline"
              href={`/${org}/finance/payments/${a.paymentId}`}
            >
              {a.payment.code}
            </Link>{" "}
            · {day(a.payment.date)} · {a.amount.toFixed(2)} {row.currency} ·{" "}
            {a.payment.status}
          </p>
        ))}
        {!row.allocations.length && (
          <p className="text-sm text-muted-foreground">
            No payments allocated.
          </p>
        )}
      </FormCard>
      {options && (
        <>
          <FormCard title="Edit draft">
            <BillForm
              org={org}
              data={options}
              initial={{
                id: row.id,
                projectId: row.projectId,
                partyId: row.partyId,
                purchaseOrderId: row.purchaseOrderId ?? "",
                date: day(row.date),
                vendorInvoiceNo: row.vendorInvoiceNo,
                vendorInvoiceDate: day(row.vendorInvoiceDate),
                dueDate: day(row.dueDate),
                notes: row.notes ?? "",
              }}
              initialLines={initialLines}
            />
          </FormCard>
          <ActionForm
            action={submitBillAction.bind(null, org)}
            submit="Submit for approval"
          >
            <input type="hidden" name="id" value={row.id} />
          </ActionForm>
        </>
      )}
      <ApprovalTimeline org={org} approvals={approvals} variant="bill" />
    </div>
  );
}
