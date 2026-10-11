"use client";

import { useCallback, useId, useState } from "react";
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  type FieldError as RHFFieldError,
  useController,
} from "react-hook-form";
import { Combobox, type Option } from "@/components/shared/combobox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { variantIdentity } from "@/modules/item-variant/util";
import { toOptions } from "./enum-options";
import type { ItemVariantValue, PickerItem } from "./item-variant-value";

export type { ItemVariantValue, PickerItem } from "./item-variant-value";

const emptyLevels = {
  level1: null,
  level2: null,
  level3: null,
  level4: null,
  level5: null,
};
const levelKeys = ["level1", "level2", "level3", "level4", "level5"] as const;

export type ItemVariantFieldProps<T extends FieldValues, TOutput = T> = {
  control: Control<T, unknown, TOutput>;
  name: FieldPathByValue<T, ItemVariantValue>;
  items: PickerItem[];
  loadItems?: (query: string) => Promise<PickerItem[]>;
  label?: string;
  description?: string;
  disabled?: boolean;
};

export function ItemVariantField<T extends FieldValues, TOutput = T>({
  control,
  name,
  items,
  loadItems,
  label = "Item",
  description,
  disabled,
}: ItemVariantFieldProps<T, TOutput>) {
  const id = useId();
  const [loadedItems, setLoadedItems] = useState<PickerItem[]>([]);
  const availableItems = new Map(loadedItems.map((item) => [item.id, item]));
  for (const item of items) availableItems.set(item.id, item);
  const { field, fieldState } = useController({
    control,
    name,
    rules: {
      validate: (raw) => {
        const value = raw as ItemVariantValue;
        const item = availableItems.get(value?.itemId ?? "");
        if (!item) return "Select item";
        try {
          variantIdentity(
            item,
            item.configs,
            levelKeys.map((key) => value[key]),
          );
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : "Invalid item levels";
        }
      },
    },
  });
  const value = (field.value as ItemVariantValue | undefined) ?? {
    itemId: null,
    ...emptyLevels,
  };
  const [initialValue] = useState(value);
  const item = availableItems.get(value.itemId ?? "");
  const loadOptions = useCallback(
    async (query: string): Promise<Option[]> => {
      if (!loadItems) return [];
      const loaded = await loadItems(query);
      // Keep selected item configurations available across remote searches.
      setLoadedItems((previous) => {
        const merged = new Map(previous.map((item) => [item.id, item]));
        for (const item of loaded) merged.set(item.id, item);
        return [...merged.values()];
      });
      return toOptions(loaded);
    },
    [loadItems],
  );
  const errorId = fieldState.error ? `${id}-error` : undefined;
  const error = fieldState.error as
    | (RHFFieldError & Partial<Record<keyof ItemVariantValue, RHFFieldError>>)
    | undefined;
  const errors = [
    error,
    error?.itemId,
    ...levelKeys.map((key) => error?.[key]),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Combobox
          id={id}
          ref={field.ref}
          onBlur={field.onBlur}
          aria-required
          aria-invalid={fieldState.invalid}
          aria-describedby={
            [description && `${id}-description`, errorId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          disabled={disabled || field.disabled}
          options={toOptions(items)}
          loadOptions={loadItems ? loadOptions : undefined}
          placeholder="Select item"
          value={value.itemId}
          onChange={(itemId) => {
            if (itemId !== value.itemId)
              field.onChange(
                itemId === initialValue.itemId
                  ? { ...initialValue }
                  : { itemId, ...emptyLevels },
              );
          }}
        />
        {description && (
          <FieldDescription id={`${id}-description`}>
            {description}
          </FieldDescription>
        )}
        <FieldError id={errorId} errors={errors} />
      </Field>
      {item?.configs
        .filter((config) => config.enabled && config.mode !== "NOT_USED")
        .map((config) => {
          const key = levelKeys[config.level - 1];
          if (!key) return null;
          const levelId = `${id}-${config.level}`;
          return (
            <Field
              key={`${item.id}:${config.level}`}
              data-invalid={fieldState.invalid}
            >
              <FieldLabel htmlFor={levelId}>{config.name}</FieldLabel>
              <Combobox
                id={levelId}
                aria-required={config.required}
                aria-invalid={fieldState.invalid}
                aria-describedby={errorId}
                disabled={disabled || field.disabled}
                onBlur={field.onBlur}
                options={toOptions(
                  config.values.filter(
                    (value) =>
                      config.mode === "ANY" ||
                      config.linkedIds.includes(value.id),
                  ),
                )}
                placeholder={`Select ${config.name}`}
                clearable
                value={value[key]}
                onChange={(selected) =>
                  field.onChange({ ...value, [key]: selected })
                }
              />
            </Field>
          );
        })}
    </div>
  );
}
