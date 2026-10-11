"use client";

import type { FieldValues } from "react-hook-form";
import { CostType } from "@/generated/prisma/enums";
import type { ComboboxProps } from "../combobox/combobox";
import { ComboboxField } from "../combobox/combobox-field";
import { enumOptions } from "./enum-options";
import type { FormFieldProps } from "./field-frame";

const options = enumOptions(CostType);

export function CostTypeField<T extends FieldValues, TOutput = T>({
  label = "Cost type",
  ...props
}: Omit<FormFieldProps<T, TOutput>, "label"> &
  Omit<
    ComboboxProps,
    "value" | "onChange" | "multiple" | "options" | "loadOptions"
  > & {
    label?: string;
  }) {
  return <ComboboxField {...props} label={label} options={options} />;
}
