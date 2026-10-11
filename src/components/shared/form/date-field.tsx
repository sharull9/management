"use client";
import type { FieldValues } from "react-hook-form";
import type { FormFieldProps } from "./field-frame";
import { TextField } from "./text-field";

export function DateField<T extends FieldValues, TOutput = T>(
  props: FormFieldProps<T, TOutput> & {
    min?: string;
    max?: string;
    disabled?: boolean;
  },
) {
  return <TextField {...props} type="date" />;
}
