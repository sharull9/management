"use client";
import type { FieldValues } from "react-hook-form";
import { DatePicker } from "../date-picker/date-picker";
import { FieldFrame, type FormFieldProps } from "./field-frame";

export function DateField<T extends FieldValues, TOutput = T>({
  min,
  max,
  disabled,
  placeholder,
  ...props
}: FormFieldProps<T, TOutput> & {
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <FieldFrame {...props}>
      {(field, accessibility) => (
        <DatePicker
          {...accessibility}
          ref={field.ref}
          name={field.name}
          value={field.value ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          min={min}
          max={max}
          disabled={disabled || field.disabled}
          placeholder={placeholder}
        />
      )}
    </FieldFrame>
  );
}
