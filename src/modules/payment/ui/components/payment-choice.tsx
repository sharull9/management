"use client";
import type { FieldValues } from "react-hook-form";
import { Combobox, type Option } from "@/components/shared/combobox/combobox";
import {
  FieldFrame,
  type FormFieldProps,
} from "@/components/shared/form/field-frame";
export function PaymentChoice<T extends FieldValues>({
  options,
  loadOptions,
  clearable,
  placeholder,
  onChange,
  ...props
}: FormFieldProps<T> & {
  options: Option[];
  loadOptions?: (query: string) => Promise<Option[]>;
  clearable?: boolean;
  placeholder?: string;
  onChange?: (value: string | null) => void;
}) {
  return (
    <FieldFrame {...props}>
      {(field, accessibility) => (
        <Combobox
          {...accessibility}
          ref={field.ref}
          onBlur={field.onBlur}
          options={options}
          loadOptions={loadOptions}
          clearable={clearable}
          placeholder={placeholder}
          value={field.value || null}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
        />
      )}
    </FieldFrame>
  );
}
