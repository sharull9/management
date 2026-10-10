"use client";
import { useState } from "react";
import { saveBillAction } from "@/server/bills/actions";
import { billTotals, calculateBillLine } from "@/server/bills/calculations";
import type { billOptions } from "@/server/bills/queries";
import { ActionForm } from "../action-form";
import { Field, SelectField } from "../fields";
import { Button } from "../ui/button";
export type BillFormData = Awaited<ReturnType<typeof billOptions>>;
export type BillDraftLine = {
  poLineId: string | null;
  grnLineId: string | null;
  itemVariantId: string | null;
  description: string;
  qty: string;
  uomId: string;
  rate: string;
  discountPercent: string;
  taxGroupId: string | null;
  poRate?: string | null;
};
export type BillInitial = {
  id?: string;
  projectId?: string;
  partyId?: string;
  purchaseOrderId?: string;
  date?: string;
  vendorInvoiceNo?: string;
  vendorInvoiceDate?: string;
  dueDate?: string;
  notes?: string;
};
export function BillForm({
  org,
  data,
  initial = {},
  initialLines,
}: {
  org: string;
  data: BillFormData;
  initial?: BillInitial;
  initialLines?: BillDraftLine[];
}) {
  const selectedOrder = data.orders.find(
    (o) => o.id === initial.purchaseOrderId,
  );
  const [orderId, setOrderId] = useState(initial.purchaseOrderId ?? "");
  const [projectId, setProjectId] = useState(
    initial.projectId ?? selectedOrder?.projectId ?? data.projects[0]?.id ?? "",
  );
  const [partyId, setPartyId] = useState(
    initial.partyId ?? selectedOrder?.partyId ?? data.vendors[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    initial.date ?? new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const blank = (): BillDraftLine => ({
    poLineId: null,
    grnLineId: null,
    itemVariantId: null,
    description: "",
    qty: "1",
    uomId: data.uoms[0]?.id ?? "",
    rate: "0",
    discountPercent: "0",
    taxGroupId: null,
  });
  const [lines, setLines] = useState<BillDraftLine[]>(
    initialLines ?? selectedOrder?.lines ?? [blank()],
  );
  const [keys, setKeys] = useState(() =>
    (initialLines ?? selectedOrder?.lines ?? [null]).map((_, i) => i),
  );
  const [nextKey, setNextKey] = useState(keys.length);
  const patch = (index: number, values: Partial<BillDraftLine>) =>
    setLines((current) =>
      current.map((l, i) => (i === index ? { ...l, ...values } : l)),
    );
  const dueDefault = new Date(
    new Date(`${date}T00:00:00Z`).getTime() +
      (data.vendors.find((v) => v.id === partyId)?.paymentTerms ?? 0) *
        86400000,
  );
  const due = Number.isNaN(dueDefault.getTime())
    ? ""
    : dueDefault.toISOString().slice(0, 10);
  let netPreview = "";
  try {
    netPreview = billTotals(
      lines.map((l) => calculateBillLine(l, [])),
    ).grandTotal.toFixed(2);
  } catch {}
  return (
    <ActionForm
      action={saveBillAction.bind(null, org)}
      submit={initial.id ? "Save draft" : "Create bill"}
    >
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Purchase order"
          name="purchaseOrderId"
          value={orderId}
          onChange={(e) => {
            const id = e.target.value;
            setOrderId(id);
            const order = data.orders.find((o) => o.id === id);
            const replacement = order?.lines ?? [blank()];
            if (order) {
              setProjectId(order.projectId);
              setPartyId(order.partyId);
            }
            setLines(replacement);
            setKeys(replacement.map((_, i) => nextKey + i));
            setNextKey(nextKey + replacement.length);
          }}
        >
          <option value="">Direct bill (services / no PO)</option>
          {data.orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Project"
          name="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
        >
          {data.projects
            .filter(
              (p) =>
                !orderId ||
                p.id === data.orders.find((o) => o.id === orderId)?.projectId,
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          label="Vendor"
          name="partyId"
          value={partyId}
          onChange={(e) => {
            setPartyId(e.target.value);
            setDueDate("");
          }}
          required
        >
          {data.vendors
            .filter(
              (v) =>
                !orderId ||
                v.id === data.orders.find((o) => o.id === orderId)?.partyId,
            )
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </SelectField>
        <Field
          label="Vendor invoice number"
          name="vendorInvoiceNo"
          defaultValue={initial.vendorInvoiceNo}
          required
          maxLength={200}
        />
        <Field
          label="Vendor invoice date"
          name="vendorInvoiceDate"
          type="date"
          defaultValue={initial.vendorInvoiceDate ?? date}
          required
        />
        <Field
          label="Bill date"
          name="date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setDueDate("");
          }}
          required
        />
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          value={dueDate || due}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <Field
          label="Notes"
          name="notes"
          defaultValue={initial.notes}
          maxLength={4000}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        PO quantities show received amounts remaining after all non-cancelled
        bills. Currency:{" "}
        {data.projects.find((p) => p.id === projectId)?.currency}. Duplicate
        vendor invoice numbers are blocked.
      </p>
      {lines.map((line, i) => (
        <div className="rounded-md border p-4 space-y-3" key={keys[i]}>
          {line.poLineId && (
            <p className="text-sm">
              PO rate: {line.poRate ?? ""}. Available quantity:{" "}
              {data.orders
                .find((o) => o.id === orderId)
                ?.lines.find(
                  (l) =>
                    l.poLineId === line.poLineId &&
                    l.grnLineId === line.grnLineId,
                )?.qty ?? ""}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {!orderId && (
              <SelectField
                label="Item variant (optional for services)"
                value={line.itemVariantId ?? ""}
                onChange={(e) =>
                  patch(i, { itemVariantId: e.target.value || null })
                }
              >
                <option value="">Service / description only</option>
                {data.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </SelectField>
            )}
            <Field
              label="Description"
              value={line.description}
              onChange={(e) => patch(i, { description: e.target.value })}
              required
              maxLength={1000}
            />
            <Field
              label="Quantity"
              inputMode="decimal"
              value={line.qty}
              onChange={(e) => patch(i, { qty: e.target.value })}
              required
            />
            <SelectField
              label="Unit"
              value={line.uomId}
              onChange={(e) => patch(i, { uomId: e.target.value })}
              required
            >
              {data.uoms
                .filter((u) => !orderId || u.id === line.uomId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </SelectField>
            <Field
              label="Billed rate"
              inputMode="decimal"
              value={line.rate}
              onChange={(e) => patch(i, { rate: e.target.value })}
              required
            />
            <Field
              label="Discount %"
              inputMode="decimal"
              value={line.discountPercent}
              onChange={(e) => patch(i, { discountPercent: e.target.value })}
              required
            />
            <SelectField
              label="Tax group"
              value={line.taxGroupId ?? ""}
              onChange={(e) => patch(i, { taxGroupId: e.target.value || null })}
            >
              <option value="">No tax</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectField>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLines(lines.filter((_, j) => j !== i));
              setKeys(keys.filter((_, j) => j !== i));
            }}
          >
            Remove line
          </Button>
        </div>
      ))}
      {!orderId && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setLines([...lines, blank()]);
            setKeys([...keys, nextKey]);
            setNextKey(nextKey + 1);
          }}
        >
          Add line
        </Button>
      )}
      {!lines.length && (
        <p role="alert">
          No billable lines. Select another PO or create a direct bill.
        </p>
      )}
      {netPreview && (
        <p>
          Net amount before tax: {netPreview}. Tax and withholding snapshots are
          calculated when saved.
        </p>
      )}
    </ActionForm>
  );
}
