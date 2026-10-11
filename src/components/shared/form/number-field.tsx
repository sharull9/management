"use client";
import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldFrame, type FormFieldProps } from "./field-frame";

export function NumberField<T extends FieldValues, TOutput = T>({
  control,
  name,
  label,
  description,
  ...props
}: FormFieldProps<T, TOutput> &
  Omit<
    ComponentProps<typeof Input>,
    "type" | "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "id"
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
          type="number"
          value={field.value ?? ""}
          onChange={(event) =>
            field.onChange(
              event.target.value === "" ? null : event.target.valueAsNumber,
            )
          }
        />
      )}
    </FieldFrame>
  );
}
