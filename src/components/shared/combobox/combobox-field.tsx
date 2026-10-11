"use client";

import type { FieldValues } from "react-hook-form";
import { FieldFrame, type FormFieldProps } from "../form/field-frame";
import { Combobox, type ComboboxProps } from "./combobox";

export function ComboboxField<T extends FieldValues, TOutput = T>({
  control,
  name,
  label,
  description,
  ...props
}: FormFieldProps<T, TOutput> & Omit<ComboboxProps, "value" | "onChange">) {
  return (
    <FieldFrame
      control={control}
      name={name}
      label={label}
      description={description}
    >
      {(field, accessibility) =>
        props.multiple ? (
          <Combobox
            {...props}
            {...accessibility}
            multiple
            value={field.value ?? []}
            onChange={field.onChange}
            ref={field.ref}
            onBlur={field.onBlur}
          />
        ) : (
          <Combobox
            {...props}
            {...accessibility}
            multiple={false}
            value={field.value ?? null}
            onChange={field.onChange}
            ref={field.ref}
            onBlur={field.onBlur}
          />
        )
      }
    </FieldFrame>
  );
}
