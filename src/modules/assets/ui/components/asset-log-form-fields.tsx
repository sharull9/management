"use client";

import { useEffect } from "react";
import type { Control, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import {
  FieldFrame,
  type FormFieldProps,
} from "@/components/shared/form/field-frame";
import { TextField } from "@/components/shared/form/text-field";
import { Input } from "@/components/ui/input";
import { dateTimeInputToIso, isoToDateTimeInput } from "./asset-form-utils";

export type AssetAllocationOption = {
  id: string;
  projectId: string;
  project: { id: string; name: string; code: string };
  startDate: string;
  endDate: string | null;
};

export function AllocationAndReadings<T extends FieldValues>({
  control,
  allocations,
  disabled,
  meterLabel,
  baseCurrency,
  setProjectId,
}: {
  control: Control<T>;
  allocations: AssetAllocationOption[];
  disabled: boolean;
  meterLabel: string;
  baseCurrency: string;
  setProjectId: (id: string) => void;
}) {
  const selected = useWatch({ control, name: "allocationId" as never });
  const allocationId = typeof selected === "string" ? selected : null;
  const options = allocations.map((item) => ({
    value: item.id,
    label: `${item.project.name} (${item.project.code}) · ${item.startDate}${item.endDate ? ` to ${item.endDate}` : " onward"}`,
  }));
  useEffect(
    () =>
      setProjectId(
        allocations.find((item) => item.id === allocationId)?.projectId ?? "",
      ),
    [allocationId, allocations, setProjectId],
  );
  return (
    <>
      {allocations.length ? (
        <ComboboxField
          control={control}
          name={"allocationId" as never}
          label="Project allocation"
          options={options}
          disabled={disabled}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Allocate this asset to a project before recording usage.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name={"startReading" as never}
          label={`Start ${meterLabel} reading`}
          inputMode="decimal"
        />
        <TextField
          control={control}
          name={"endReading" as never}
          label={`End ${meterLabel} reading`}
          inputMode="decimal"
        />
      </div>
      {baseCurrency && (
        <p className="text-xs text-muted-foreground">
          Calculated equipment and energy costs use {baseCurrency}.
        </p>
      )}
    </>
  );
}

export function NotesField<T extends FieldValues>({
  control,
}: {
  control: Control<T>;
}) {
  return <TextField control={control} name={"notes" as never} label="Notes" />;
}

export function DateTimeField<T extends FieldValues>({
  control,
  name,
  label,
}: FormFieldProps<T> & { label: string }) {
  return (
    <FieldFrame control={control} name={name} label={`${label} (UTC)`}>
      {(field, accessibility) => (
        <Input
          {...accessibility}
          ref={field.ref}
          name={field.name}
          type="datetime-local"
          value={isoToDateTimeInput(field.value)}
          onChange={(event) =>
            field.onChange(
              event.target.value ? dateTimeInputToIso(event.target.value) : "",
            )
          }
          onBlur={field.onBlur}
          required
        />
      )}
    </FieldFrame>
  );
}
