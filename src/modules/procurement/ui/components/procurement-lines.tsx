"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type UseFormReturn, useFieldArray, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { ItemVariantField } from "@/components/shared/form/item-variant-field";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { Button } from "@/components/ui/button";
import type { procurementFormInput } from "../../schema";
import {
  findProcurementChoices,
  procurementSource,
} from "../../server/picker-actions";
import type { ProcurementFormData, ProcurementItem } from "../../type";
import { lineDefaults } from "./form-defaults";

type FormInput = z.input<typeof procurementFormInput>;
type Props = {
  form: UseFormReturn<FormInput, unknown, FormInput>;
  org: string;
  kind: FormInput["kind"];
  projectId: string | null;
  data: ProcurementFormData;
  poId: string | null;
  items: ProcurementItem[];
  loadItems: (query: string) => Promise<ProcurementItem[]>;
};
type PoLine = {
  id: string;
  name: string;
  itemId: string;
  item: FormInput["lines"][number]["item"];
  uomId: string;
  pending: string;
};
export function ProcurementLines(props: Props) {
  const { form, org, kind, projectId, poId, data } = props;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const [poLines, setPoLines] = useState<PoLine[]>(
    data.orders.find((o) => o.id === poId)?.lines ?? [],
  );
  const [sourceError, setSourceError] = useState("");
  const previousPo = useRef(poId);
  useEffect(() => {
    setSourceError("");
    if (previousPo.current !== poId) {
      form.setValue("lines", [lineDefaults()]);
      previousPo.current = poId;
    }
    if (kind !== "receipts" || !poId || !projectId) {
      setPoLines([]);
      return;
    }
    let active = true;
    procurementSource(org, kind, projectId, poId)
      .then((source) => {
        if (active) setPoLines(source.poLines);
      })
      .catch((error: unknown) => {
        if (active) {
          setPoLines([]);
          setSourceError(
            error instanceof Error
              ? error.message
              : "Could not load order lines.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [org, kind, projectId, poId, form]);
  return (
    <div className="space-y-4">
      {sourceError && (
        <p role="alert" className="text-sm text-destructive">
          {sourceError}
        </p>
      )}
      {fields.map((field, index) => (
        <Line
          key={field.id}
          {...props}
          index={index}
          poLines={poLines}
          remove={() => remove(index)}
          canRemove={fields.length > 1}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={fields.length >= 100}
        onClick={() => append(lineDefaults())}
      >
        Add line
      </Button>
    </div>
  );
}
function Line({
  form,
  org,
  kind,
  projectId,
  data,
  index,
  items,
  loadItems,
  poLines,
  remove,
  canRemove,
}: Props & {
  index: number;
  poLines: PoLine[];
  remove: () => void;
  canRemove: boolean;
}) {
  const line = useWatch({ control: form.control, name: `lines.${index}` });
  const itemId = line?.item?.itemId;
  const prLineId = line?.prLineId;
  const poLineId = line?.poLineId;
  const previousItem = useRef(itemId);
  const previousPr = useRef(prLineId);
  const previousPoLine = useRef(poLineId);
  const [sourceError, setSourceError] = useState("");
  useEffect(() => {
    if (kind === "receipts" || previousItem.current === itemId) return;
    previousItem.current = itemId;
    const item = items.find((i) => i.id === itemId);
    form.setValue(
      `lines.${index}.uomId`,
      (kind === "consumption" || kind === "transfers"
        ? item?.stockUomId
        : (item?.purchaseUomId ?? item?.stockUomId)) ?? null,
    );
    form.setValue(`lines.${index}.taxGroupId`, item?.defaultTaxGroupId ?? null);
    form.setValue(`lines.${index}.prLineId`, null);
  }, [itemId, items, kind, index, form]);
  useEffect(() => {
    if (previousPr.current === prLineId) return;
    previousPr.current = prLineId;
    if (!prLineId || !projectId) return;
    let active = true;
    setSourceError("");
    form.setValue(`lines.${index}.uomId`, null);
    procurementSource(org, "orders", projectId, prLineId)
      .then(({ prLine }) => {
        if (!active || !prLine) return;
        const next = lineDefaults(prLine);
        previousItem.current = next.item.itemId;
        form.setValue(`lines.${index}`, next, { shouldValidate: true });
      })
      .catch((error: unknown) => {
        if (active)
          setSourceError(
            error instanceof Error
              ? error.message
              : "Could not load request line.",
          );
      });
    return () => {
      active = false;
    };
  }, [prLineId, org, projectId, index, form]);
  useEffect(() => {
    if (previousPoLine.current === poLineId) return;
    const source = poLines.find((l) => l.id === poLineId);
    if (!source) return;
    previousPoLine.current = poLineId;
    form.setValue(`lines.${index}.item`, source.item);
    form.setValue(`lines.${index}.uomId`, source.uomId);
    form.setValue(`lines.${index}.receivedQty`, Number(source.pending));
    form.setValue(`lines.${index}.acceptedQty`, Number(source.pending));
    form.setValue(`lines.${index}.rejectedQty`, 0);
  }, [poLineId, poLines, index, form]);
  const selectedItem = items.find(
    (i) =>
      i.id ===
      (kind === "receipts"
        ? poLines.find((l) => l.id === poLineId)?.itemId
        : itemId),
  );
  const loadPrLines = useMemo(
    () =>
      findProcurementChoices.bind(null, org, kind, projectId ?? "", "prLines"),
    [org, kind, projectId],
  );
  const control = form.control;
  return (
    <fieldset className="space-y-4 rounded-md border p-4">
      <legend className="px-2 text-sm font-medium">Line {index + 1}</legend>
      {sourceError && (
        <p role="alert" className="text-sm text-destructive">
          {sourceError}
        </p>
      )}
      {kind === "orders" && (
        <ComboboxField
          control={control}
          name={`lines.${index}.prLineId`}
          label="Approved PR line (optional)"
          clearable
          options={toOptions(
            data.prLines.filter((l) => l.projectId === projectId),
          )}
          loadOptions={projectId ? loadPrLines : undefined}
        />
      )}
      {kind === "receipts" ? (
        <ComboboxField
          control={control}
          name={`lines.${index}.poLineId`}
          label="PO line"
          options={poLines
            .filter((l) => Number(l.pending) > 0 || l.id === poLineId)
            .map((l) => ({
              value: l.id,
              label: l.name,
              description: `Pending ${l.pending}`,
            }))}
        />
      ) : (
        <ItemVariantField
          control={control}
          name={`lines.${index}.item`}
          items={items}
          loadItems={loadItems}
        />
      )}
      {kind === "receipts" && (
        <ItemVariantField
          control={control}
          name={`lines.${index}.item`}
          items={items}
          label="PO item"
          disabled
        />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <ComboboxField
          control={control}
          name={`lines.${index}.uomId`}
          label="UOM"
          options={toOptions(
            data.uoms.filter((u) => selectedItem?.uomIds.includes(u.id)),
          )}
        />
        {kind === "receipts" ? (
          <>
            <NumberField
              control={control}
              name={`lines.${index}.receivedQty`}
              label="Received quantity"
              min={0}
              step="0.0001"
            />
            <NumberField
              control={control}
              name={`lines.${index}.acceptedQty`}
              label="Accepted quantity"
              min={0}
              step="0.0001"
            />
            <NumberField
              control={control}
              name={`lines.${index}.rejectedQty`}
              label="Rejected quantity"
              min={0}
              step="0.0001"
            />
            <TextField
              control={control}
              name={`lines.${index}.remarks`}
              label="Remarks"
            />
          </>
        ) : (
          <NumberField
            control={control}
            name={`lines.${index}.qty`}
            label="Quantity"
            min={0}
            step="0.0001"
          />
        )}
        {kind === "requests" && (
          <NumberField
            control={control}
            name={`lines.${index}.estimatedRate`}
            label="Estimated rate"
            min={0}
            step="0.0001"
          />
        )}
        {kind === "orders" && (
          <>
            <NumberField
              control={control}
              name={`lines.${index}.rate`}
              label="Rate"
              min={0}
              step="0.0001"
            />
            <NumberField
              control={control}
              name={`lines.${index}.discountPercent`}
              label="Discount %"
              min={0}
              max={100}
              step="0.0001"
            />
            <ComboboxField
              control={control}
              name={`lines.${index}.taxGroupId`}
              label="Tax group"
              clearable
              options={toOptions(data.groups)}
            />
          </>
        )}
        {(kind === "requests" || kind === "orders") && (
          <TextField
            control={control}
            name={`lines.${index}.description`}
            label="Description"
          />
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!canRemove}
        onClick={remove}
      >
        Remove line
      </Button>
    </fieldset>
  );
}
