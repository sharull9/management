"use client";
import { useEffect, useRef } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox";
import {
  CheckboxField,
  ItemVariantField,
  TextField,
} from "@/components/shared/form";
import { toOptions } from "@/components/shared/form/enum-options";
import { Button } from "@/components/ui/button";
import type { invoiceFormInput } from "../../schema";
import type {
  findInvoiceItems,
  findInvoiceTaxGroups,
} from "../../server/picker-actions";
import type { InvoiceFormData } from "../../type";

type Input = z.input<typeof invoiceFormInput>;
const emptySelection = {
  itemId: null,
  level1: null,
  level2: null,
  level3: null,
  level4: null,
  level5: null,
};
export function InvoiceLine({
  form,
  index,
  data,
  scope,
  loadItems,
  loadGroups,
  remove,
  removable,
}: {
  form: UseFormReturn<Input>;
  index: number;
  data: InvoiceFormData;
  scope: string;
  loadItems: typeof findInvoiceItems extends (
    org: string,
    query: string,
  ) => infer R
    ? (query: string) => R
    : never;
  loadGroups: (query: string) => ReturnType<typeof findInvoiceTaxGroups>;
  remove: () => void;
  removable: boolean;
}) {
  const line = useWatch({ control: form.control, name: `lines.${index}` });
  const previous = useRef({
    itemId: line.selection.itemId,
    lineType: line.lineType,
  });
  useEffect(() => {
    if (
      previous.current.lineType !== line.lineType &&
      line.lineType === "SERVICE"
    ) {
      form.setValue(`lines.${index}.selection`, emptySelection);
      form.setValue(`lines.${index}.fromProjectStock`, false);
    }
    if (previous.current.itemId !== line.selection.itemId) {
      const item = data.items.find((item) => item.id === line.selection.itemId);
      form.setValue(`lines.${index}.uomId`, item?.stockUomId ?? null);
      form.setValue(
        `lines.${index}.taxGroupId`,
        item?.defaultTaxGroupId ?? null,
      );
    }
    previous.current = {
      itemId: line.selection.itemId,
      lineType: line.lineType,
    };
  }, [form, index, line.lineType, line.selection.itemId, data.items]);
  return (
    <fieldset className="space-y-3 rounded border p-4">
      <legend>Line {index + 1}</legend>
      <ComboboxField
        control={form.control}
        name={`lines.${index}.lineType`}
        label="Line type"
        options={[
          { value: "GOODS", label: "Goods" },
          { value: "SERVICE", label: "Service" },
        ]}
      />
      {line.lineType === "GOODS" && (
        <ItemVariantField
          control={form.control}
          name={`lines.${index}.selection`}
          items={data.items}
          loadItems={loadItems}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          control={form.control}
          name={`lines.${index}.description`}
          label="Description"
        />
        <TextField
          control={form.control}
          name={`lines.${index}.qty`}
          label="Quantity"
          inputMode="decimal"
        />
        <ComboboxField
          control={form.control}
          name={`lines.${index}.uomId`}
          label="Unit"
          options={toOptions(data.uoms)}
        />
        <TextField
          control={form.control}
          name={`lines.${index}.rate`}
          label="Rate"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name={`lines.${index}.discountPercent`}
          label="Discount %"
          inputMode="decimal"
        />
        <ComboboxField
          control={form.control}
          name={`lines.${index}.taxGroupId`}
          label="Tax group"
          options={data.groups
            .filter(
              (group) =>
                scope === "ANY" ||
                group.scope === "ANY" ||
                group.scope === scope ||
                group.id === line.taxGroupId,
            )
            .map((group) => ({
              value: group.id,
              label:
                group.name +
                (scope !== "ANY" &&
                group.scope !== "ANY" &&
                group.scope !== scope
                  ? " (conflicts with place of supply)"
                  : ""),
            }))}
          loadOptions={loadGroups}
          clearable
        />
      </div>
      <CheckboxField
        control={form.control}
        name={`lines.${index}.fromProjectStock`}
        label="From project stock (goods only)"
        disabled={line.lineType !== "GOODS"}
      />
      <Button
        type="button"
        variant="outline"
        disabled={!removable}
        onClick={remove}
      >
        Remove line
      </Button>
    </fieldset>
  );
}
