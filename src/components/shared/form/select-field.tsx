"use client";

import type { FieldValues } from "react-hook-form";
import {
  ComboboxField,
  type ComboboxProps,
} from "@/components/shared/combobox";
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
