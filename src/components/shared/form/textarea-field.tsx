"use client";
import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FieldFrame, type FormFieldProps } from "./field-frame";

export function TextareaField<T extends FieldValues, TOutput = T>({
  control,
  name,
  label,
  description,
  ...props
}: FormFieldProps<T, TOutput> &
  Omit<
    ComponentProps<typeof Textarea>,
    "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "id"
  >) {
  return (
    <FieldFrame
      control={control}
      name={name}
      label={label}
      description={description}
    >
      {(field, accessibility) => (
        <Textarea
          {...props}
          {...field}
          {...accessibility}
          value={field.value ?? ""}
        />
      )}
    </FieldFrame>
  );
}
