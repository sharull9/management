"use client";

import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type ControllerRenderProps,
  type FieldValues,
  type Path,
} from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

export type FormFieldProps<T extends FieldValues, TOutput = T> = {
  control: Control<T, unknown, TOutput>;
  name: Path<T>;
  label: string;
  description?: string;
};

export function FieldFrame<T extends FieldValues, TOutput>({
  control,
  name,
  label,
  description,
  children,
}: FormFieldProps<T, TOutput> & {
  children: (
    field: ControllerRenderProps<T, Path<T>>,
    accessibility: {
      id: string;
      "aria-invalid": boolean;
      "aria-describedby"?: string;
    },
  ) => ReactNode;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {children(field, {
            id,
            "aria-invalid": fieldState.invalid,
            "aria-describedby":
              [
                description && `${id}-description`,
                fieldState.error && `${id}-error`,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
          })}
          {description && (
            <FieldDescription id={`${id}-description`}>
              {description}
            </FieldDescription>
          )}
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
