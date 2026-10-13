import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { db } from "@/core/db";
import { Decimal } from "@/core/decimal";
import { describeRate } from "@/modules/currency/rate-format";
import { attachProformaAction } from "../../server/actions";
import { type DocumentKind, documentKinds } from "../../server/approval";
import { documentDetail, procurementData } from "../../server/queries";
import { formData } from "../../util";
import { draftFormValues } from "../components/draft-form-data";
import { ProcurementDetailLinesTable } from "../components/procurement-detail-lines-table";
import { ProcurementForm } from "../components/procurement-form";
import { SubmitProcurementForm } from "../components/submit-procurement-form";

const titles = {
  requests: "Purchase requests",
  orders: "Purchase orders",
  receipts: "Goods receipts",
  transfers: "Stock transfers",
};
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export async function ProcurementDetail({
  org,
  kind,
  documentId,
}: {
  org: string;
  kind: DocumentKind;
  documentId: string;
}) {
  const { ctx, row, approvals, attachments } = await documentDetail(
    org,
    kind,
    documentId,
  );
  const isOrder = "grandTotal" in row,
    isRequest = "estimatedTotal" in row,
    isReceipt = "poId" in row;
  const canEdit =
    ctx.isAdmin || ctx.permissions.has(documentKinds[kind].permission);
  const draftEditable = row.status === "DRAFT" && canEdit;
  // Stock transfers have no dedicated edit route yet, so they keep the inline form.
  const inlineData =
    draftEditable && kind === "transfers"
      ? await procurementData(org, undefined, true)
      : null;
  const inputs = inlineData ? formData(inlineData) : null;
  const { initial, initialLines } = inputs
    ? draftFormValues(row)
    : { initial: {}, initialLines: [] };
  const lines = row.lines.map((l) => {
    const receipt = "poLine" in l;
    return {
      id: l.id,
      name: receipt ? l.poLine.variant.name : l.variant.name,
      qty: receipt ? l.receivedQty.toString() : l.qty.toString(),
      uom: l.uom.code,
      description:
        "description" in l
          ? l.description
          : "remarks" in l
            ? (l.remarks ?? "")
            : "",
      rate:
        "rate" in l
          ? l.rate.toString()
          : "estimatedRate" in l
            ? l.estimatedRate.toString()
            : "",
      discount: "discountPercent" in l ? l.discountPercent.toString() : "",
      amount:
        "netAmount" in l
          ? l.netAmount.toFixed(2)
          : "estimatedAmount" in l
            ? l.estimatedAmount.toFixed(2)
            : "",
      received: "receivedQty" in l ? l.receivedQty.toString() : "",
      accepted: "acceptedQty" in l ? l.acceptedQty.toString() : "",
      rejected: "rejectedQty" in l ? l.rejectedQty.toString() : "",
      pending:
        "qty" in l && "receivedQty" in l
          ? new Decimal(l.qty).sub(l.receivedQty).toString()
          : "",
    };
  });
  const relatedReceipts = isOrder
    ? await db.goodsReceipt.findMany({
        where: { poId: row.id, organizationId: ctx.org.id },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const canBill =
    isOrder &&
    ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"].includes(
      row.status,
    ) &&
    (ctx.isAdmin || ctx.permissions.has("bill.create"));
  const overview = [
    {
      label: "Project",
      value: (
        <Link
          className="underline"
          href={`/${org}/projects/${row.projectId}/materials`}
        >
          {row.project.name}
        </Link>
      ),
    },
    { label: "Status", value: row.status.replaceAll("_", " ") },
    ...(isOrder
      ? [
          { label: "Vendor", value: row.vendor.displayName },
          { label: "Order date", value: day(row.date) },
          {
            label: "Payment terms",
            value: `${row.paymentTerms} ${row.paymentDays} days`,
          },
          { label: "Currency", value: row.currency },
          ...(row.currency !== ctx.org.baseCurrency
            ? [
                {
                  label: "Exchange rate",
                  value: describeRate(
                    row.currency,
                    ctx.org.baseCurrency,
                    row.exchangeRate.toString(),
                  ),
                },
              ]
            : []),
          { label: "Site", value: row.site?.name ?? null },
          {
            label: "Grand total",
            value: `${row.grandTotal.toFixed(2)} ${row.currency}`,
          },
          ...(row.currency !== ctx.org.baseCurrency
            ? [
                {
                  label: "Base grand total",
                  value: `${row.baseGrandTotal.toFixed(2)} ${ctx.org.baseCurrency}`,
                },
              ]
            : []),
        ]
      : []),
    ...(isRequest
      ? [
          { label: "Requested by", value: row.requestedBy.name },
          { label: "Needed by", value: day(row.neededBy) },
          { label: "Estimated total", value: row.estimatedTotal.toFixed(2) },
        ]
      : []),
    ...(isReceipt
      ? [
          {
            label: "Purchase order",
            value: (
              <Link
                className="underline"
                href={`/${org}/procurement/orders/${row.poId}`}
              >
                {row.order.code}
              </Link>
            ),
          },
          { label: "Received on", value: day(row.receivedDate) },
          { label: "Currency", value: row.currency },
          ...(row.currency !== ctx.org.baseCurrency
            ? [
                {
                  label: "Exchange rate",
                  value: describeRate(
                    row.currency,
                    ctx.org.baseCurrency,
                    row.exchangeRate.toString(),
                  ),
                },
              ]
            : []),
          { label: "Received by", value: row.receivedBy.name },
          { label: "Challan", value: row.challanNumber },
          { label: "Vehicle", value: row.vehicleNumber },
        ]
      : []),
    ...(!isOrder && !isRequest && !isReceipt
      ? [
          { label: "Destination", value: row.toProject.name },
          { label: "Date", value: day(row.date) },
        ]
      : []),
  ];
  const listHref = `/${org}/${kind === "transfers" ? "inventory" : "procurement"}/${kind}`;
  return (
    <>
      <Button asChild variant="link" size="sm" className="w-fit px-0">
        <Link href={listHref}>{titles[kind]}</Link>
      </Button>
      <PageHeading
        eyebrow={titles[kind]}
        title={row.code}
        description={row.project.name}
        actions={
          <>
            <StatusBadge status={row.status} />
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {draftEditable && kind !== "transfers" && (
                <Button asChild variant="outline">
                  <Link href={`${listHref}/${row.id}/edit`}>Edit draft</Link>
                </Button>
              )}
              {canBill && (
                <Button asChild variant="outline">
                  <Link href={`/${org}/procurement/bills/new?po=${row.id}`}>
                    Create bill
                  </Link>
                </Button>
              )}
              {draftEditable && (
                <SubmitProcurementForm org={org} kind={kind} id={row.id} />
              )}
            </div>
          </>
        }
      />
      <section className="space-y-3">
        <SectionHeader title="Overview" />
        <DetailList className="max-w-2xl" items={overview} />
      </section>
      <UrlTabs
        tabs={[
          {
            value: "lines",
            label: "Lines",
            count: lines.length,
            content: <ProcurementDetailLinesTable lines={lines} />,
          },
          ...(isOrder
            ? [
                {
                  value: "totals",
                  label: "Taxes and totals",
                  content: (
                    <>
                      <ItemGroup>
                        {row.lines.flatMap((l) =>
                          l.taxes.map((t) => (
                            <Item key={t.id} variant="outline">
                              <ItemContent>
                                <ItemTitle>
                                  {l.variant.name} · {t.name}{" "}
                                  {t.rate.toString()}%
                                  {t.isWithholding ? " (withholding)" : ""}:{" "}
                                  {t.amount.toFixed(2)}
                                </ItemTitle>
                              </ItemContent>
                            </Item>
                          )),
                        )}
                      </ItemGroup>
                      <DetailList
                        className="max-w-sm"
                        items={[
                          {
                            label: "Taxable subtotal",
                            value: row.subtotal.toFixed(2),
                          },
                          { label: "Tax", value: row.taxTotal.toFixed(2) },
                          {
                            label: "Withholding",
                            value: row.withholdingTotal.toFixed(2),
                          },
                          {
                            label: "Grand total",
                            value: `${row.grandTotal.toFixed(2)} ${row.currency}`,
                          },
                          ...(row.currency !== ctx.org.baseCurrency
                            ? [
                                {
                                  label: `Base subtotal (${ctx.org.baseCurrency})`,
                                  value: row.baseSubtotal.toFixed(2),
                                },
                                {
                                  label: `Base tax (${ctx.org.baseCurrency})`,
                                  value: row.baseTaxTotal.toFixed(2),
                                },
                                {
                                  label: `Base withholding (${ctx.org.baseCurrency})`,
                                  value: row.baseWithholdingTotal.toFixed(2),
                                },
                                {
                                  label: `Base grand total (${ctx.org.baseCurrency})`,
                                  value: row.baseGrandTotal.toFixed(2),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </>
                  ),
                },
                {
                  value: "receipts",
                  label: "Receipts",
                  count: relatedReceipts.length,
                  content: relatedReceipts.length ? (
                    <ItemGroup>
                      {relatedReceipts.map((r) => (
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
                  ) : (
                    <EmptyState title="No receipts yet." />
                  ),
                },
                {
                  value: "attachments",
                  label: "Attachments",
                  count: attachments.length,
                  content: (
                    <>
                      {attachments.length ? (
                        <ItemGroup>
                          {attachments.map((a) => (
                            <Item key={a.id} variant="outline">
                              <ItemContent>
                                <ItemTitle>
                                  <a
                                    className="underline"
                                    href={`/api/attachments/${a.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {a.filename}
                                  </a>
                                </ItemTitle>
                              </ItemContent>
                            </Item>
                          ))}
                        </ItemGroup>
                      ) : (
                        <EmptyState title="No attachments yet." />
                      )}
                      {canEdit && (
                        <div className="print:hidden">
                          <ActionForm
                            action={attachProformaAction.bind(null, org)}
                            submit="Attach proforma"
                          >
                            <input type="hidden" name="id" value={row.id} />
                            <Field>
                              <FieldLabel htmlFor="proforma-file">
                                Proforma (PDF / image, max 900 KB)
                              </FieldLabel>
                              <Input
                                id="proforma-file"
                                name="file"
                                type="file"
                                accept="application/pdf,image/png,image/jpeg"
                                required
                              />
                            </Field>
                          </ActionForm>
                        </div>
                      )}
                    </>
                  ),
                },
              ]
            : []),
          {
            value: "approvals",
            label: "Approvals",
            content: (
              <ApprovalTimeline
                org={org}
                approvals={approvals}
                variant="procurement"
              />
            ),
          },
        ]}
      />
      {inputs && (
        <FormCard title="Edit draft">
          <ProcurementForm
            org={org}
            kind={kind}
            data={inputs}
            id={row.id}
            projectId={row.projectId}
            initial={initial}
            initialLines={initialLines}
          />
        </FormCard>
      )}
    </>
  );
}
