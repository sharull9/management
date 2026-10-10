import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { Field } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { db } from "@/core/db";
import { Decimal } from "@/core/decimal";
import {
  attachProformaAction,
  submitProcurementAction,
} from "../../server/actions";
import { type DocumentKind, documentKinds } from "../../server/approval";
import { documentDetail, procurementData } from "../../server/queries";
import type { DraftLine } from "../../type";
import { formData, selectedLevels } from "../../util";
import { ProcurementForm } from "../components/procurement-form";

const titles = {
  requests: "Purchase requests",
  orders: "Purchase orders",
  receipts: "Goods receipts",
  transfers: "Stock transfers",
};
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
  const d =
    row.status === "DRAFT" && canEdit
      ? await procurementData(org, undefined, kind === "transfers")
      : null;
  const initial: Record<string, string> = {};
  let initialLines: DraftLine[] = [];
  if (d) {
    if (isRequest) {
      initial.stageId = row.stageId ?? "";
      initial.taskId = row.taskId ?? "";
      initial.neededBy = row.neededBy?.toISOString().slice(0, 10) ?? "";
      initialLines = row.lines.map((l) => ({
        itemId: l.variant.itemId,
        levels: selectedLevels(l.variant),
        qty: l.qty.toString(),
        uomId: l.uomId,
        description: l.description,
        estimatedRate: l.estimatedRate.toString(),
      }));
    } else if (isOrder) {
      Object.assign(initial, {
        vendorPartyId: row.vendorPartyId,
        siteId: row.siteId ?? "",
        date: row.date.toISOString().slice(0, 10),
        paymentTerms: row.paymentTerms,
        paymentDays: String(row.paymentDays),
        currency: row.currency,
        receiptTolerancePercent: row.receiptTolerancePercent.toString(),
      });
      initialLines = row.lines.map((l) => ({
        itemId: l.variant.itemId,
        levels: selectedLevels(l.variant),
        qty: l.qty.toString(),
        uomId: l.uomId,
        description: l.description,
        rate: l.rate.toString(),
        discountPercent: l.discountPercent.toString(),
        taxGroupId: l.taxGroupId,
        prLineId: l.prLineId,
      }));
    } else if (isReceipt) {
      Object.assign(initial, {
        poId: row.poId,
        siteId: row.siteId ?? "",
        receivedDate: row.receivedDate.toISOString().slice(0, 10),
        challanNumber: row.challanNumber ?? "",
        vehicleNumber: row.vehicleNumber ?? "",
      });
      initialLines = row.lines.map((l) => ({
        itemId: "",
        levels: [],
        qty: "1",
        uomId: l.uomId,
        poLineId: l.poLineId,
        receivedQty: l.receivedQty.toString(),
        acceptedQty: l.acceptedQty.toString(),
        rejectedQty: l.rejectedQty.toString(),
        remarks: l.remarks ?? "",
      }));
    } else {
      Object.assign(initial, {
        toProjectId: row.toProjectId,
        date: row.date.toISOString().slice(0, 10),
      });
      initialLines = row.lines.map((l) => ({
        itemId: l.variant.itemId,
        levels: selectedLevels(l.variant),
        qty: l.qty.toString(),
        uomId: l.uomId,
      }));
    }
  }
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
  return (
    <div className="space-y-6 procurement-document">
      <PageHeading
        title={`${row.code} · ${titles[kind]}`}
        description={`${row.project.name} · ${row.status.replaceAll("_", " ")}`}
      />
      <Badge variant="secondary">{row.status.replaceAll("_", " ")}</Badge>
      {isOrder &&
        ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"].includes(
          row.status,
        ) &&
        (ctx.isAdmin || ctx.permissions.has("bill.create")) && (
          <Link
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground print:hidden"
            href={`/${org}/procurement/bills/new?po=${row.id}`}
          >
            Create bill
          </Link>
        )}
      <p className="text-sm">
        <Link
          className="underline"
          href={`/${org}/projects/${row.projectId}/materials`}
        >
          Project materials
        </Link>
        {isOrder &&
          ` · Vendor: ${row.vendor.displayName} · Date: ${row.date.toISOString().slice(0, 10)} · ${row.paymentTerms} ${row.paymentDays} days · ${row.currency}${row.site ? ` · Site: ${row.site.name}` : ""}`}
        {isRequest &&
          ` · Requested by ${row.requestedBy.name} · Needed by ${row.neededBy?.toISOString().slice(0, 10) ?? "—"}`}
        {isReceipt && (
          <>
            {" "}
            · Against{" "}
            <Link
              className="underline"
              href={`/${org}/procurement/orders/${row.poId}`}
            >
              {row.order.code}
            </Link>{" "}
            · Received {row.receivedDate.toISOString().slice(0, 10)} ·{" "}
            {row.receivedBy.name} · Challan {row.challanNumber ?? "—"} · Vehicle{" "}
            {row.vehicleNumber ?? "—"}
          </>
        )}
        {!isOrder &&
          !isRequest &&
          !isReceipt &&
          ` · To: ${row.toProject.name} · ${row.date.toISOString().slice(0, 10)}`}
      </p>
      <FormCard title="Lines">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Item variant",
                  "Quantity",
                  "UOM",
                  "Rate",
                  "Discount %",
                  "Net / estimate",
                  "Received",
                  "Accepted",
                  "Rejected",
                  "Pending",
                ].map((h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t">
                  {[
                    l.name,
                    l.qty,
                    l.uom,
                    l.rate,
                    l.discount,
                    l.amount,
                    l.received,
                    l.accepted,
                    l.rejected,
                    l.pending,
                  ].map((cell, i) => (
                    <td
                      key={`${l.id}:${i}`}
                      className="p-2"
                      title={i === 0 ? l.description : undefined}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormCard>
      {isRequest && (
        <p className="font-medium">
          Estimated total: {row.estimatedTotal.toFixed(2)}
        </p>
      )}
      {isOrder && (
        <FormCard title="Tax snapshot and totals">
          <ul className="space-y-2 text-sm">
            {row.lines.flatMap((l) =>
              l.taxes.map((t) => (
                <li key={t.id}>
                  {l.variant.name} · {t.name} {t.rate.toString()}%
                  {t.isWithholding ? " (withholding)" : ""}:{" "}
                  {t.amount.toFixed(2)}
                </li>
              )),
            )}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <dt>Taxable subtotal</dt>
            <dd>{row.subtotal.toFixed(2)}</dd>
            <dt>Tax</dt>
            <dd>{row.taxTotal.toFixed(2)}</dd>
            <dt>Withholding</dt>
            <dd>{row.withholdingTotal.toFixed(2)}</dd>
            <dt className="font-semibold">Grand total</dt>
            <dd className="font-semibold">
              {row.grandTotal.toFixed(2)} {row.currency}
            </dd>
          </dl>
          <div className="mt-4 space-y-2">
            {relatedReceipts.map((r) => (
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
            {attachments.map((a) => (
              <p key={a.id}>
                <a
                  className="underline"
                  href={`/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.filename}
                </a>
              </p>
            ))}
          </div>
          {canEdit && (
            <div className="mt-4 print:hidden">
              <ActionForm
                action={attachProformaAction.bind(null, org)}
                submit="Attach proforma"
              >
                <input type="hidden" name="id" value={row.id} />
                <Field
                  label="Proforma (PDF / image, max 900 KB)"
                  name="file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  required
                />
              </ActionForm>
            </div>
          )}
        </FormCard>
      )}
      {d && (
        <div className="space-y-6 print:hidden">
          <FormCard title="Edit draft">
            <ProcurementForm
              org={org}
              kind={kind}
              data={formData(d)}
              id={row.id}
              projectId={row.projectId}
              initial={initial}
              initialLines={initialLines}
            />
          </FormCard>
          <ActionForm
            action={submitProcurementAction.bind(null, org)}
            submit="Submit for approval"
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={row.id} />
          </ActionForm>
        </div>
      )}
      <ApprovalTimeline org={org} approvals={approvals} variant="procurement" />
    </div>
  );
}
