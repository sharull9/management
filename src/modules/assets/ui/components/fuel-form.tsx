"use client";

import { useEffect } from "react";
import { useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { assetFuelLogInput } from "../../schema";
import { saveFuelLogAction } from "../../server/log-actions";
import {
  type AssetAllocationOption,
  NotesField,
} from "./asset-log-form-fields";

export function FuelForm({
  org,
  assetId,
  allocations,
  baseCurrency,
  entry,
}: {
  org: string;
  assetId: string;
  allocations: AssetAllocationOption[];
  baseCurrency: string;
  entry?: z.input<typeof assetFuelLogInput>;
}) {
  const form = useZodForm<
    z.input<typeof assetFuelLogInput>,
    z.output<typeof assetFuelLogInput>
  >(assetFuelLogInput, {
    id: entry?.id,
    assetId,
    allocationId: entry?.allocationId ?? "",
    projectId: entry?.projectId ?? "",
    date: entry?.date ?? "",
    quantityLitres: entry?.quantityLitres ?? "",
    totalCost: entry?.totalCost ?? "",
    meterReading: entry?.meterReading ?? "",
    notes: entry?.notes ?? "",
  });
  const allocationId = useWatch({
    control: form.control,
    name: "allocationId",
  });
  useEffect(
    () =>
      form.setValue(
        "projectId",
        allocations.find((item) => item.id === allocationId)?.projectId ?? "",
      ),
    [allocationId, allocations, form],
  );
  return (
    <ActionFormShell
      form={form}
      action={saveFuelLogAction.bind(null, org)}
      submit={entry ? "Save fuel record" : "Record fuel"}
    >
      {allocations.length ? (
        <ComboboxField
          control={form.control}
          name="allocationId"
          label="Project allocation"
          options={allocations.map((item) => ({
            value: item.id,
            label: `${item.project.name} (${item.project.code}) · ${item.startDate}${item.endDate ? ` to ${item.endDate}` : " onward"}`,
          }))}
          disabled={!!entry}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Allocate this asset to a project before recording fuel.
        </p>
      )}
      <DateField control={form.control} name="date" label="Fuel date" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="quantityLitres"
          label="Fuel quantity (litres)"
          inputMode="decimal"
          required
        />
        <TextField
          control={form.control}
          name="totalCost"
          label={`Total cost (${baseCurrency})`}
          inputMode="decimal"
          required
        />
        <TextField
          control={form.control}
          name="meterReading"
          label="Meter reading"
          inputMode="decimal"
          required
        />
      </div>
      <NotesField control={form.control} />
    </ActionFormShell>
  );
}
