"use client";

import type { FieldValues } from "react-hook-form";
import { CostType } from "@/generated/prisma/enums";
import { enumOptions } from "./enum-options";
import { SelectField, type SelectFieldProps } from "./select-field";

const options = enumOptions(CostType);

export function CostTypeField<T extends FieldValues, TOutput = T>({
  label = "Cost type",
  ...props
}: Omit<SelectFieldProps<T, TOutput>, "options" | "loadOptions" | "label"> & {
  label?: string;
}) {
  return <SelectField {...props} label={label} options={options} />;
}
