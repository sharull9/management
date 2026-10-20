"use client";

import { useWatch } from "react-hook-form";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { assetUsageInput } from "../../schema";
import { saveUsageAction } from "../../server/log-actions";
import {
  AllocationAndReadings,
  type AssetAllocationOption,
  DateTimeField,
  NotesField,
} from "./asset-log-form-fields";

export function UsageForm({
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
  entry?: z.input<typeof assetUsageInput>;
}) {
  const form = useZodForm<
    z.input<typeof assetUsageInput>,
    z.output<typeof assetUsageInput>
  >(assetUsageInput, {
    id: entry?.id,
    assetId,
    allocationId: entry?.allocationId ?? "",
    projectId: entry?.projectId ?? "",
    startAt: entry?.startAt ?? "",
    endAt: entry?.endAt ?? "",
    startReading: entry?.startReading ?? "",
    endReading: entry?.endReading ?? "",
    notes: entry?.notes ?? "",
  });
  const startAt = useWatch({ control: form.control, name: "startAt" });
  return (
    <ActionFormShell
      form={form}
      action={saveUsageAction.bind(null, org)}
      submit={entry ? "Save usage" : "Record usage"}
    >
      <AllocationAndReadings
        control={form.control}
        allocations={allocations}
        disabled={!!entry}
        meterLabel="hour meter"
        baseCurrency={baseCurrency}
        setProjectId={(id) => form.setValue("projectId", id)}
      />
      <DateTimeField
        control={form.control}
        name="startAt"
        label="Usage start"
      />
      <DateTimeField control={form.control} name="endAt" label="Usage end" />
      {startAt && (
        <p className="text-xs text-muted-foreground">
          Duration and equipment costs are calculated from these times in{" "}
          {baseCurrency}.
        </p>
      )}
      <NotesField control={form.control} />
    </ActionFormShell>
  );
}
