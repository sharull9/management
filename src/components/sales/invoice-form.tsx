"use client";
import { useState } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { ItemPicker, type PickerItem } from "@/components/shared/item-picker";
import { Button } from "@/components/ui/button";
import type { TaxInput } from "@/server/procurement/calculations";
import { saveInvoiceAction } from "@/server/sales/actions";
import {
  calculateInvoiceLine,
  invoiceTotals,
  suggestSalesTaxScope,
} from "@/server/sales/calculations";

type Choice = { id: string; name: string };
export type InvoiceDraftLine = {
  itemId: string | null;
  levels: (string | null)[];
  description: string;
  qty: string;
  uomId: string;
  rate: string;
  discountPercent: string;
  taxGroupId: string | null;
  fromProjectStock: boolean;
};
export type InvoiceFormData = {
  items: PickerItem[];
  uoms: Choice[];
  states: Choice[];
  orgStateId: string | null;
  allowOrgInvoices: boolean;
  projects: (Choice & { clientPartyId: string | null })[];
  customers: (Choice & { stateId: string | null; paymentTerms: number })[];
  groups: (Choice & { scope: string; components: TaxInput[] })[];
};
const blank: InvoiceDraftLine = {
  itemId: null,
  levels: [],
  description: "",
  qty: "1",
  uomId: "",
  rate: "0",
  discountPercent: "0",
  taxGroupId: null,
  fromProjectStock: false,
};
export function InvoiceForm({
  org,
  data,
  initial,
}: {
  org: string;
  data: InvoiceFormData;
  initial?: {
    id?: string;
    projectId?: string | null;
    partyId?: string;
    date?: string;
    dueDate?: string;
    stateId?: string | null;
    notes?: string;
    lines?: InvoiceDraftLine[];
  };
}) {
  const [projectId, setProjectId] = useState(
    initial?.projectId ??
      (data.allowOrgInvoices ? "" : (data.projects[0]?.id ?? "")),
  );
  const [partyId, setPartyId] = useState(
    initial?.partyId ??
      data.projects.find((p) => p.id === projectId)?.clientPartyId ??
      "",
  );
  const [stateId, setStateId] = useState(
    initial?.stateId ??
      data.customers.find((c) => c.id === partyId)?.stateId ??
      "",
  );
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10),
  );
  const termsDate = (customerId: string, invoiceDate: string) => {
    const d = new Date(`${invoiceDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return "";
    d.setUTCDate(
      d.getUTCDate() +
        (data.customers.find((c) => c.id === customerId)?.paymentTerms ?? 0),
    );
    return d.toISOString().slice(0, 10);
  };
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ?? termsDate(partyId, date),
  );
  const [lines, setLines] = useState(
    (initial?.lines ?? [{ ...blank }]).map((line, key) => ({ key, line })),
  );
  const [serial, setSerial] = useState(lines.length);
  const scope = suggestSalesTaxScope(data.orgStateId, stateId || null);
  const customerChanged = (id: string) => {
    setPartyId(id);
    setStateId(data.customers.find((c) => c.id === id)?.stateId ?? "");
    setDueDate(termsDate(id, date));
  };
  const update = (key: number, field: string, value: string | boolean) =>
    setLines((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row.line };
        if (field.startsWith("level")) {
          next.levels = [...next.levels];
          next.levels[Number(field.slice(5)) - 1] = String(value) || null;
        } else {
          Object.assign(next, {
            [field]:
              value === "" && ["itemId", "taxGroupId"].includes(field)
                ? null
                : value,
          });
        }
        if (field === "itemId") {
          const item = data.items.find((i) => i.id === value);
          next.levels = [];
          next.uomId = item?.stockUomId ?? "";
          next.taxGroupId = item?.defaultTaxGroupId ?? null;
        }
        return { ...row, line: next };
      }),
    );
  let preview = "Enter quantities and rates to calculate totals.";
  try {
    const totals = invoiceTotals(
      lines.map(({ line }) =>
        calculateInvoiceLine({
          ...line,
          components:
            data.groups.find((g) => g.id === line.taxGroupId)?.components ?? [],
        }),
      ),
    );
    preview = `Subtotal ${totals.subtotal} · Discount ${totals.discountTotal} · Tax ${totals.taxTotal} · Withholding ${totals.withholdingTotal} · Grand ${totals.grandTotal} · Payable ${totals.payableTotal}`;
  } catch {}
  return (
    <ActionForm action={saveInvoiceAction.bind(null, org)} submit="Save draft">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Project (optional)"
          name="projectId"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            customerChanged(
              data.projects.find((p) => p.id === e.target.value)
                ?.clientPartyId ?? "",
            );
          }}
        >
          {data.allowOrgInvoices && <option value="">No project</option>}
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Customer"
          name="partyId"
          value={partyId}
          onChange={(e) => customerChanged(e.target.value)}
          required
        >
          <option value="">Select customer</option>
          {data.customers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Invoice date"
          name="date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setDueDate(termsDate(partyId, e.target.value));
          }}
          required
        />
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <SelectField
          label="Place of supply"
          name="stateId"
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
        >
          <option value="">Unspecified</option>
          {data.states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <Field label="Notes" name="notes" defaultValue={initial?.notes ?? ""} />
      </div>
      <p className="text-sm">
        Suggested tax scope: {scope}. Invoice currency follows the project or
        organization.
      </p>
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(lines.map((r) => r.line))}
      />
      {lines.map(({ key, line }, index) => (
        <fieldset
          key={key}
          className="space-y-3 rounded border p-4"
          onChange={(e) => {
            const t = e.target;
            if (
              t instanceof HTMLInputElement ||
              t instanceof HTMLSelectElement
            ) {
              if (!t.name.startsWith(`line${key}.`)) return;
              update(
                key,
                t.name.replace(`line${key}.`, ""),
                t.type === "checkbox"
                  ? (t as HTMLInputElement).checked
                  : t.value,
              );
            }
          }}
        >
          <legend>Line {index + 1}</legend>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={!line.itemId}
              onChange={(e) => {
                if (e.target.checked) update(key, "itemId", "");
                else update(key, "itemId", data.items[0]?.id ?? "");
              }}
            />
            Free-text line
          </label>
          {line.itemId && (
            <ItemPicker
              key={`${key}:${line.itemId}`}
              items={data.items}
              prefix={`line${key}.`}
              defaultItemId={line.itemId}
              defaultLevels={line.levels}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Description"
              name={`line${key}.description`}
              value={line.description}
              onChange={() => {}}
              required={!line.itemId}
            />
            <Field
              label="Quantity"
              name={`line${key}.qty`}
              value={line.qty}
              onChange={() => {}}
              required
            />
            <SelectField
              label="Unit"
              name={`line${key}.uomId`}
              value={line.uomId}
              onChange={() => {}}
              required
            >
              <option value="">Select unit</option>
              {data.uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectField>
            <Field
              label="Rate"
              name={`line${key}.rate`}
              value={line.rate}
              onChange={() => {}}
              required
            />
            <Field
              label="Discount %"
              name={`line${key}.discountPercent`}
              value={line.discountPercent}
              onChange={() => {}}
              required
            />
            <SelectField
              label="Tax group"
              name={`line${key}.taxGroupId`}
              value={line.taxGroupId ?? ""}
              onChange={() => {}}
            >
              <option value="">No tax</option>
              {data.groups
                .filter(
                  (g) =>
                    scope === "ANY" ||
                    g.scope === "ANY" ||
                    g.scope === scope ||
                    g.id === line.taxGroupId,
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {scope !== "ANY" && g.scope !== "ANY" && g.scope !== scope
                      ? " (conflicts with place of supply)"
                      : ""}
                  </option>
                ))}
            </SelectField>
          </div>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              name={`line${key}.fromProjectStock`}
              checked={line.fromProjectStock}
              onChange={() => {}}
            />
            From project stock (goods only)
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={lines.length === 1}
            onClick={() =>
              setLines((rows) => rows.filter((r) => r.key !== key))
            }
          >
            Remove line
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setLines((rows) => [...rows, { key: serial, line: { ...blank } }]);
          setSerial(serial + 1);
        }}
      >
        Add line
      </Button>
      <p className="text-sm" aria-live="polite">
        {preview}
      </p>
    </ActionForm>
  );
}
