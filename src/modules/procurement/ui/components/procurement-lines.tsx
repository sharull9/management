"use client";
import { useState } from "react";
import { Field, SelectField } from "@/components/shared/fields";
import { ItemPicker, type PickerItem } from "@/components/shared/item-picker";
import { Button } from "@/components/ui/button";

type Choice = { id: string; name: string };

import type { DraftLine } from "../../type";

const emptyLine: DraftLine = {
  itemId: "",
  levels: [],
  qty: "1",
  uomId: "",
  description: "",
  estimatedRate: "0",
  rate: "0",
  discountPercent: "0",
  taxGroupId: null,
  prLineId: null,
  receivedQty: "1",
  acceptedQty: "1",
  rejectedQty: "0",
  remarks: "",
};
export function ProcurementLines({
  kind,
  items,
  uoms,
  groups,
  prLines = [],
  poLines = [],
  initialLines,
}: {
  kind: "requests" | "orders" | "receipts" | "consumption" | "transfers";
  items: PickerItem[];
  uoms: Choice[];
  groups: Choice[];
  prLines?: { id: string; name: string; line: DraftLine }[];
  poLines?: { id: string; name: string; uomId: string; pending: string }[];
  initialLines?: DraftLine[];
}) {
  const [lines, setLines] = useState(
    (initialLines ?? [{ ...emptyLine }]).map((line, i) => ({ key: i, line })),
  );
  const [serial, setSerial] = useState(lines.length);
  const update = (key: number, field: string, value: string) =>
    setLines((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row.line };
        if (field.startsWith("level")) {
          next.levels = [...next.levels];
          next.levels[Number(field.slice(5)) - 1] = value || null;
        } else if (field === "prLineId" && value) {
          const source = prLines.find((l) => l.id === value);
          return {
            ...row,
            line: { ...source?.line, prLineId: value } as DraftLine,
          };
        } else if (field === "poLineId") {
          const source = poLines.find((l) => l.id === value);
          return {
            ...row,
            line: {
              ...next,
              poLineId: value,
              uomId: source?.uomId ?? "",
              receivedQty: source?.pending ?? "1",
              acceptedQty: source?.pending ?? "1",
              rejectedQty: "0",
            },
          };
        } else {
          Object.assign(next, {
            [field]:
              value ||
              (field === "taxGroupId" || field === "prLineId" ? null : ""),
          });
          if (field === "itemId") {
            next.levels = [];
            const item = items.find((i) => i.id === value);
            next.uomId =
              (kind === "consumption" || kind === "transfers"
                ? item?.stockUomId
                : (item?.purchaseUomId ?? item?.stockUomId)) ?? "";
            next.taxGroupId = item?.defaultTaxGroupId ?? null;
            next.prLineId = null;
          }
        }
        return { ...row, line: next };
      }),
    );
  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(lines.map((r) => r.line))}
      />
      {lines.map(({ key, line }, index) => (
        <fieldset
          key={`${key}:${line.prLineId ?? ""}`}
          className="space-y-4 rounded-md border p-4"
          onChange={(e) => {
            const target = e.target;
            if (
              target instanceof HTMLInputElement ||
              target instanceof HTMLSelectElement
            )
              update(key, target.name.replace(`line${key}.`, ""), target.value);
          }}
        >
          <legend className="px-2 text-sm font-medium">Line {index + 1}</legend>
          {kind === "orders" && (
            <SelectField
              label="Approved PR line (optional)"
              name={`line${key}.prLineId`}
              value={line.prLineId ?? ""}
              onChange={() => {}}
            >
              <option value="">Direct purchase</option>
              {prLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          )}
          {kind === "receipts" ? (
            <SelectField
              label="PO line"
              name={`line${key}.poLineId`}
              value={line.poLineId ?? ""}
              onChange={() => {}}
              required
            >
              <option value="">Select PO line</option>
              {poLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · pending {l.pending}
                </option>
              ))}
            </SelectField>
          ) : (
            <ItemPicker
              key={`${key}:${line.itemId}`}
              items={items}
              prefix={`line${key}.`}
              defaultItemId={line.itemId}
              defaultLevels={line.levels}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="UOM"
              name={`line${key}.uomId`}
              value={line.uomId}
              onChange={() => {}}
              required
            >
              <option value="">Select unit</option>
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectField>
            {kind === "receipts" ? (
              <>
                <Field
                  label="Received quantity"
                  name={`line${key}.receivedQty`}
                  value={line.receivedQty ?? "1"}
                  onChange={() => {}}
                  required
                />
                <Field
                  label="Accepted quantity"
                  name={`line${key}.acceptedQty`}
                  value={line.acceptedQty ?? "1"}
                  onChange={() => {}}
                  required
                />
                <Field
                  label="Rejected quantity"
                  name={`line${key}.rejectedQty`}
                  value={line.rejectedQty ?? "0"}
                  onChange={() => {}}
                  required
                />
                <Field
                  label="Remarks"
                  name={`line${key}.remarks`}
                  value={line.remarks ?? ""}
                  onChange={() => {}}
                />
              </>
            ) : (
              <Field
                label="Quantity"
                name={`line${key}.qty`}
                value={line.qty}
                onChange={() => {}}
                required
              />
            )}
            {kind === "requests" && (
              <Field
                label="Estimated rate"
                name={`line${key}.estimatedRate`}
                value={line.estimatedRate ?? "0"}
                onChange={() => {}}
                required
              />
            )}
            {kind === "orders" && (
              <>
                <Field
                  label="Rate"
                  name={`line${key}.rate`}
                  value={line.rate ?? "0"}
                  onChange={() => {}}
                  required
                />
                <Field
                  label="Discount %"
                  name={`line${key}.discountPercent`}
                  value={line.discountPercent ?? "0"}
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
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </SelectField>
              </>
            )}
            {(kind === "requests" || kind === "orders") && (
              <Field
                label="Description"
                name={`line${key}.description`}
                value={line.description ?? ""}
                onChange={() => {}}
              />
            )}
          </div>
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
          setLines((rows) => [
            ...rows,
            { key: serial, line: { ...emptyLine } },
          ]);
          setSerial((n) => n + 1);
        }}
      >
        Add line
      </Button>
    </div>
  );
}
