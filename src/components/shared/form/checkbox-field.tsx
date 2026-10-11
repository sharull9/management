"use client";
import type { FieldValues } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldFrame, type FormFieldProps } from "./field-frame";

export function CheckboxField<T extends FieldValues, TOutput = T>({
  disabled,
  ...props
}: FormFieldProps<T, TOutput> & { disabled?: boolean }) {
  return (
    <FieldFrame {...props}>
      {(field, accessibility) => (
        <Checkbox
          className="size-4! self-start"
          {...accessibility}
          ref={field.ref}
          name={field.name}
          checked={!!field.value}
          onCheckedChange={(checked) => field.onChange(checked === true)}
          onBlur={field.onBlur}
          disabled={disabled || field.disabled}
        />
      )}
    </FieldFrame>
  );
}
