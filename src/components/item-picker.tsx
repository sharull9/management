"use client";
import { useState } from "react";
import type { LevelConfig } from "@/server/masters/variant";
import { SelectField } from "./fields";
export type PickerItem = {
  id: string;
  name: string;
  configs: LevelConfig[];
  stockUomId?: string;
  purchaseUomId?: string | null;
  defaultTaxGroupId?: string | null;
};
export function ItemPicker({
  items,
  prefix = "",
  defaultItemId = "",
  defaultLevels = [],
}: {
  items: PickerItem[];
  prefix?: string;
  defaultItemId?: string;
  defaultLevels?: (string | null)[];
}) {
  const [itemId, setItemId] = useState(defaultItemId);
  const item = items.find((i) => i.id === itemId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        label="Item"
        name={`${prefix}itemId`}
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        required
      >
        <option value="">Select item</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </SelectField>
      {item?.configs
        .filter((c) => c.enabled && c.mode !== "NOT_USED")
        .map((c) => (
          <SelectField
            key={`${itemId}:${c.level}`}
            label={c.name}
            name={`${prefix}level${c.level}`}
            required={c.required}
            defaultValue={
              itemId === defaultItemId ? (defaultLevels[c.level - 1] ?? "") : ""
            }
          >
            <option value="">Select {c.name}</option>
            {c.values
              .filter((v) => c.mode === "ANY" || c.linkedIds.includes(v.id))
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </SelectField>
        ))}
    </div>
  );
}
export function CheckField({
  label,
  name,
  defaultChecked = false,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
export function ItemTypeStockFields({
  type = "PRODUCT",
  stockTracked,
}: {
  type?: string;
  stockTracked?: boolean;
}) {
  const [selectedType, setType] = useState(type);
  const [tracked, setTracked] = useState(stockTracked ?? type !== "SERVICE");
  return (
    <>
      <SelectField
        label="Type"
        name="type"
        value={selectedType}
        onChange={(e) => {
          setType(e.target.value);
          setTracked(e.target.value !== "SERVICE");
        }}
      >
        {["PRODUCT", "SERVICE", "RAW_MATERIAL"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </SelectField>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="stockTracked"
          checked={tracked}
          onChange={(e) => setTracked(e.target.checked)}
        />
        Track stock
      </label>
    </>
  );
}
