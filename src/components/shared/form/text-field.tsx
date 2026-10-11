"use client";
import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldFrame, type FormFieldProps } from "./field-frame";

export function TextField<T extends FieldValues, TOutput = T>({
  control,
  name,
  label,
  description,
  ...props
}: FormFieldProps<T, TOutput> &
  Omit<
    ComponentProps<typeof Input>,
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
        <Input
          {...props}
          {...field}
          {...accessibility}
          value={field.value ?? ""}
        />
      )}
    </FieldFrame>
  );
}
