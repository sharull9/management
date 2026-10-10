import Link from "next/link";
import { db } from "@/server/db";
import {
  attachProformaAction,
  submitProcurementAction,
} from "@/server/procurement/actions";
import {
  type DocumentKind,
  documentKinds,
} from "@/server/procurement/approvals";
import { Decimal } from "@/server/procurement/calculations";
import {
  documentDetail,
  moduleProjectWhere,
  procurementData,
} from "@/server/procurement/queries";
import { ActionForm } from "./action-form";
import { Field } from "./fields";
import { FormCard } from "./form-card";
import { PageHeading } from "./page-heading";
import { ProcurementForm, type ProcurementFormData } from "./procurement-form";
import type { DraftLine } from "./procurement-lines";
import { Badge } from "./ui/badge";

type Data = Awaited<ReturnType<typeof procurementData>>;
const selectedLevels = (v: {
  level1Id: string | null;
  level2Id: string | null;
  level3Id: string | null;
  level4Id: string | null;
  level5Id: string | null;
}) => [v.level1Id, v.level2Id, v.level3Id, v.level4Id, v.level5Id];
export function formData(d: Data): ProcurementFormData {
  return {
    projects: d.projects.map((p) => ({
      id: p.id,
      name: `${p.code} · ${p.name}`,
      currency: p.currency,
    })),
    items: d.items,
    uoms: d.uoms.map((u) => ({ id: u.id, name: `${u.code} · ${u.name}` })),
    vendors: d.vendors.map((v) => ({ id: v.id, name: v.displayName })),
    groups: d.groups.map((g) => ({ id: g.id, name: g.name, scope: g.scope })),
    sites: d.sites.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
    })),
    stages: d.stages.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
    })),
    tasks: d.tasks.map((t) => ({
      id: t.id,
      name: `${t.code} · ${t.title}`,
      projectId: t.projectId,
    })),
    taxSuggestions: d.taxSuggestions,
    prLines: d.requests
      .filter((r) => r.status === "APPROVED")
      .flatMap((r) =>
        r.lines.map((l) => ({
          id: l.id,
          name: `${r.code} · ${l.variant.name}`,
          projectId: r.projectId,
          line: {
            itemId: l.variant.itemId,
            levels: selectedLevels(l.variant),
            qty: l.qty.toString(),
            uomId: l.uomId,
            description: l.description,
            rate: l.estimatedRate.toString(),
            discountPercent: "0",
            taxGroupId: null,
            prLineId: l.id,
          },
        })),
      ),
    orders: d.orders
      .filter(
        (o) => o.status === "APPROVED" || o.status === "PARTIALLY_RECEIVED",
      )
      .map((o) => ({
        id: o.id,
        name: `${o.code} · ${o.vendor.displayName}`,
        projectId: o.projectId,
        lines: o.lines
          .filter((l) => l.receivedQty.lt(l.qty))
          .map((l) => ({
            id: l.id,
            name: l.variant.name,
            uomId: l.uomId,
            pending: l.qty.sub(l.receivedQty).toString(),
          })),
      })),
  };
}
const titles = {
  requests: "Purchase requests",
  orders: "Purchase orders",
  receipts: "Goods receipts",
  transfers: "Stock transfers",
};
export async function ProcurementList({
  org,
  kind,
  projectId,
}: {
  org: string;
  kind: DocumentKind;
  projectId?: string;
}) {
  const d = await procurementData(org, projectId, kind === "transfers");
  const rows = d[kind];
  const writable = await db.project.findMany({
    where: {
      ...moduleProjectWhere(d.ctx, documentKinds[kind].permission),
      id: { in: d.projects.map((p) => p.id) },
    },
    select: { id: true },
  });
  const inputs = formData(d);
  inputs.projects = inputs.projects.filter((p) =>
    writable.some((w) => w.id === p.id),
  );
  return (
    <>
      <PageHeading
        title={titles[kind]}
        description="Draft, submit, and follow approval and receipt progress."
      />
      <FormCard title="Documents">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Number</th>
                <th className="p-2">Project</th>
                <th className="p-2">Status</th>
                <th className="p-2">Total / destination</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">
                    <Link
                      className="underline"
                      href={`/${org}/${kind === "transfers" ? "inventory" : "procurement"}/${kind}/${r.id}`}
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="p-2">{r.project.name}</td>
                  <td className="p-2">
                    <Badge variant="secondary">
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {"grandTotal" in r
                      ? r.grandTotal.toFixed(2)
                      : "estimatedTotal" in r
                        ? r.estimatedTotal.toFixed(2)
                        : "toProject" in r
                          ? r.toProject.name
                          : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            No documents yet.
          </p>
        )}
      </FormCard>
      {!!writable.length && (
        <FormCard
          title={`Create ${kind === "requests" ? "purchase request" : kind === "orders" ? "purchase order" : kind === "receipts" ? "goods receipt" : "stock transfer"}`}
        >
          <ProcurementForm
            org={org}
            kind={kind}
            data={inputs}
            projectId={projectId}
          />
        </FormCard>
      )}
    </>
  );
}
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
      <FormCard title="Approval timeline">
        <Link
          className="text-sm underline print:hidden"
          href={`/${org}/approvals`}
        >
          Open approvals inbox
        </Link>
        {approvals.map((a) => (
          <div key={a.id} className="mt-4 space-y-2">
            <p className="font-medium">
              {a.status} · {a.createdAt.toLocaleDateString("en-IN")}
            </p>
            <ol className="space-y-2 text-sm">
              {a.steps.map((s) => (
                <li key={s.id}>
                  {s.sequence}. {s.name} · {s.status}
                  {s.actedBy ? ` · ${s.actedBy.name}` : ""}
                  {s.comment ? ` · ${s.comment}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {!approvals.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Not submitted yet.
          </p>
        )}
      </FormCard>
    </div>
  );
}
