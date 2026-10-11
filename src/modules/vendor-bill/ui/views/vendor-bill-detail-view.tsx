import Link from "next/link";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { billDetail } from "../../server/queries";
import { BackLink } from "../components/back-link";
import { AttachBillForm } from "../components/bill-document-forms";
import { SubmitBillButton } from "../components/bill-submit-button";

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
  const taxCount = row.lines.reduce((n, l) => n + l.taxes.length, 0);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackLink href={`/${org}/procurement/bills`}>All vendor bills</BackLink>
        <PageHeading
          eyebrow={row.code}
          title={`Bill ${row.vendorInvoiceNo}`}
          description={`${row.party.displayName} · ${row.project.name}`}
          actions={
            <>
              <StatusBadge status={row.status} />
              {canEdit && (
                <>
                  <Button asChild variant="outline">
                    <Link href={`/${org}/procurement/bills/${row.id}/edit`}>
                      Edit draft
                    </Link>
                  </Button>
                  <SubmitBillButton org={org} billId={row.id} code={row.code} />
                </>
              )}
            </>
          }
        />
      </div>
      <section className="space-y-3">
        <SectionHeader title="Overview" />
        <DetailList
          className="max-w-2xl"
          items={[
            { label: "Vendor", value: row.party.displayName },
            { label: "Project", value: row.project.name },
            { label: "Vendor invoice no.", value: row.vendorInvoiceNo },
            { label: "Vendor invoice date", value: day(row.vendorInvoiceDate) },
            { label: "Bill date", value: day(row.date) },
            { label: "Due date", value: day(row.dueDate) },
            { label: "Currency", value: row.currency },
            {
              label: "Grand total",
              value: `${row.grandTotal.toFixed(2)} ${row.currency}`,
            },
            {
              label: "Balance",
              value: `${row.payableTotal.sub(row.paidTotal).toFixed(2)} ${row.currency}`,
            },
            { label: "Notes", value: row.notes?.trim() || null },
          ]}
        />
      </section>
      <UrlTabs
        tabs={[
          {
            value: "lines",
            label: "Lines",
            count: row.lines.length,
            content: (
              <>
                <SectionHeader title="Bill lines" />
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
                          <TableCell className="p-2">
                            {l.qty.toString()}
                          </TableCell>
                          <TableCell className="p-2">{l.uom.code}</TableCell>
                          <TableCell className="p-2">
                            {l.poRate?.toString() ?? ""}
                          </TableCell>
                          <TableCell className="p-2">
                            {l.rate.toString()}
                          </TableCell>
                          <TableCell className="p-2">
                            {l.discountPercent.toString()}
                          </TableCell>
                          <TableCell className="p-2">
                            {l.varianceAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-2">
                            {l.lineSubtotal.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-2">
                            {l.lineTax.toFixed(2)}
                          </TableCell>
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
              </>
            ),
          },
          {
            value: "totals",
            label: "Tax & totals",
            count: taxCount,
            content: (
              <>
                <SectionHeader title="Tax breakdown and totals" />
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
                  {!taxCount && <EmptyState title="No taxes applied." />}
                </ItemGroup>
                <DetailList
                  className="max-w-md"
                  items={[
                    {
                      label: "Subtotal before discount",
                      value: row.subtotal.toFixed(2),
                    },
                    { label: "Discount", value: row.discountTotal.toFixed(2) },
                    { label: "Tax", value: row.taxTotal.toFixed(2) },
                    { label: "Grand total", value: row.grandTotal.toFixed(2) },
                    {
                      label: "Withholding",
                      value: row.withholdingTotal.toFixed(2),
                    },
                    { label: "Payable", value: row.payableTotal.toFixed(2) },
                    { label: "Paid", value: row.paidTotal.toFixed(2) },
                    {
                      label: "Balance",
                      value: `${row.payableTotal.sub(row.paidTotal).toFixed(2)} ${row.currency}`,
                    },
                  ]}
                />
              </>
            ),
          },
          {
            value: "attachments",
            label: "Attachments",
            count: attachments.length,
            content: (
              <>
                <SectionHeader
                  title="Vendor invoice attachments"
                  actions={
                    canEdit && (
                      <CreateSheet label="Attach invoice">
                        <AttachBillForm org={org} billId={row.id} />
                      </CreateSheet>
                    )
                  }
                />
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
                  {!attachments.length && (
                    <EmptyState title="No attachments yet." />
                  )}
                </ItemGroup>
              </>
            ),
          },
          {
            value: "payments",
            label: "Payments",
            count: row.allocations.length,
            content: (
              <>
                <SectionHeader title="Allocated payments" />
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
                          · {day(a.payment.date)} · {a.amount.toFixed(2)}{" "}
                          {row.currency} · {a.payment.status}
                        </ItemTitle>
                      </ItemContent>
                    </Item>
                  ))}
                </ItemGroup>
                {!row.allocations.length && (
                  <EmptyState title="No payments allocated." />
                )}
              </>
            ),
          },
          {
            value: "procurement",
            label: "Linked procurement",
            count: row.purchaseOrder
              ? 1 + row.purchaseOrder.goodsReceiptRows.length
              : 0,
            content: (
              <>
                <SectionHeader title="Linked procurement" />
                {row.purchaseOrder ? (
                  <>
                    <Link
                      className="underline"
                      href={`/${org}/procurement/orders/${row.purchaseOrder.id}`}
                    >
                      {row.purchaseOrder.code}
                    </Link>
                    <ItemGroup>
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
                  </>
                ) : (
                  <EmptyState title="Direct bill with no purchase order." />
                )}
              </>
            ),
          },
          {
            value: "approvals",
            label: "Approvals",
            count: approvals.length,
            content: (
              <ApprovalTimeline
                org={org}
                approvals={approvals}
                variant="bill"
              />
            ),
          },
        ]}
      />
    </div>
  );
}
