"use client";

import type { FieldPath, FieldValues } from "react-hook-form";
import { CheckboxField } from "./checkbox-field";
import type { FormFieldProps } from "./field-frame";
import { SelectField } from "./select-field";

export type MaterialCostRecognitionFieldProps<
  T extends FieldValues,
  TOutput = T,
> = Omit<FormFieldProps<T, TOutput>, "label"> & {
  label?: string;
  disabled?: boolean;
} & (
    | { existingProject: true; confirmationName: FieldPath<T> }
    | { existingProject?: false; confirmationName?: never }
  );

export function MaterialCostRecognitionField<
  T extends FieldValues,
  TOutput = T,
>({
  control,
  name,
  label = "Material cost recognition",
  description = "On receipt recognizes accepted GRNs and adjusts costs on transfers. On consumption recognizes materials when used.",
  disabled,
  existingProject,
  confirmationName,
}: MaterialCostRecognitionFieldProps<T, TOutput>) {
  return (
    <div className="space-y-3">
      <SelectField
        control={control}
        name={name}
        label={label}
        description={description}
        disabled={disabled}
        options={[
          { value: "ON_CONSUMPTION", label: "On consumption" },
          { value: "ON_RECEIPT", label: "On receipt" },
        ]}
      />
      {existingProject && (
        <>
          <p className="text-sm text-amber-700">
            Changes apply only to future transactions. Past cost entries are not
            restated. Projects with any stock movement history require
            confirmation, even if stock on hand is zero.
          </p>
          <CheckboxField
            control={control}
            name={confirmationName}
            disabled={disabled}
            label="I confirm this change applies only to future transactions and past cost entries will not be restated."
          />
        </>
      )}
    </div>
  );
}
