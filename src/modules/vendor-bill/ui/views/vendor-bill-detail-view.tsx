import Link from "next/link";
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
import { billDetail, billOptions } from "../../server/queries";
import type { BillDraftLine } from "../../type";
import {
  AttachBillForm,
  SubmitBillForm,
} from "../components/bill-document-forms";
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
    receiptName: l.grnLine?.receipt.code,
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
          <ItemGroup className="mt-2">
            {row.purchaseOrder.goodsReceiptRows.map((r) => (
              <Item key={r.id} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    <Link
                      className="underline"
                      href={`/${org}/procurement/receipts/${r.id}`}
                    >
                      {r.code}
                    </Link>{" "}
                    · {r.status}
                  </ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </FormCard>
      )}
      <FormCard title="Bill lines">
        <div className="overflow-x-auto">
          <Table className="w-full text-left text-sm">
            <TableHeader>
              <TableRow>
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
                  <TableHead key={h} className="p-2">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.lines.map((l) => (
                <TableRow key={l.id} className="border-t">
                  <TableCell className="p-2">{l.description}</TableCell>
                  <TableCell className="p-2">{l.qty.toString()}</TableCell>
                  <TableCell className="p-2">{l.uom.code}</TableCell>
                  <TableCell className="p-2">
                    {l.poRate?.toString() ?? ""}
                  </TableCell>
                  <TableCell className="p-2">{l.rate.toString()}</TableCell>
                  <TableCell className="p-2">
                    {l.discountPercent.toString()}
                  </TableCell>
                  <TableCell className="p-2">
                    {l.varianceAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="p-2">
                    {l.lineSubtotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="p-2">{l.lineTax.toFixed(2)}</TableCell>
                  <TableCell className="p-2">
                    {l.lineTotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="p-2">
                    {l.grnLine && (
                      <Link
                        className="underline"
                        href={`/${org}/procurement/receipts/${l.grnLine.receiptId}`}
                      >
                        {l.grnLine.receipt.code}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </FormCard>
      <FormCard title="Tax breakdown and totals">
        <ItemGroup>
          {row.lines.flatMap((l) =>
            l.taxes.map((t) => (
              <Item key={t.id} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    {l.description} · {t.name} {t.rate.toString()}%{" "}
                    {t.isWithholding ? "(withholding)" : ""}:{" "}
                    {t.amount.toFixed(2)}
                  </ItemTitle>
                </ItemContent>
              </Item>
            )),
          )}
        </ItemGroup>
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
        <ItemGroup>
          {attachments.map((a) => (
            <Item key={a.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  <a
                    className="underline"
                    href={`/${org}/procurement/bills/${row.id}/attachments/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.filename}
                  </a>
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
          {!attachments.length && <EmptyState title="No attachments yet." />}
        </ItemGroup>
        {canEdit && (
          <div className="mt-4">
            <AttachBillForm org={org} billId={row.id} />
          </div>
        )}
      </FormCard>
      <FormCard title="Allocated payments">
        <ItemGroup>
          {row.allocations.map((a) => (
            <Item key={a.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  <Link
                    className="underline"
                    href={`/${org}/finance/payments/${a.paymentId}`}
                  >
                    {a.payment.code}
                  </Link>{" "}
                  · {day(a.payment.date)} · {a.amount.toFixed(2)} {row.currency}{" "}
                  · {a.payment.status}
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
        {!row.allocations.length && (
          <EmptyState title="No payments allocated." />
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
          <SubmitBillForm org={org} billId={row.id} />
        </>
      )}
      <ApprovalTimeline org={org} approvals={approvals} variant="bill" />
    </div>
  );
}
