"use client";

import type { FieldValues } from "react-hook-form";
import type { ComboboxProps } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import type { FormFieldProps } from "./field-frame";

export type SelectFieldProps<
  T extends FieldValues,
  TOutput = T,
> = FormFieldProps<T, TOutput> &
  Omit<ComboboxProps, "value" | "onChange" | "multiple">;

export function SelectField<T extends FieldValues, TOutput = T>(
  props: SelectFieldProps<T, TOutput>,
) {
  return <ComboboxField {...props} multiple={false} />;
}

export function MultiSelectField<T extends FieldValues, TOutput = T>(
  props: SelectFieldProps<T, TOutput>,
) {
  return <ComboboxField {...props} multiple />;
}
