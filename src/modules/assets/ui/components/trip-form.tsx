"use client";

import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { assetTripInput } from "../../schema";
import { saveTripAction } from "../../server/log-actions";
import {
  AllocationAndReadings,
  type AssetAllocationOption,
  DateTimeField,
  NotesField,
} from "./asset-log-form-fields";

export function TripForm({
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
  entry?: z.input<typeof assetTripInput>;
}) {
  const form = useZodForm<
    z.input<typeof assetTripInput>,
    z.output<typeof assetTripInput>
  >(assetTripInput, {
    id: entry?.id,
    assetId,
    allocationId: entry?.allocationId ?? "",
    projectId: entry?.projectId ?? "",
    outAt: entry?.outAt ?? "",
    inAt: entry?.inAt ?? "",
    startReading: entry?.startReading ?? "",
    endReading: entry?.endReading ?? "",
    notes: entry?.notes ?? "",
  });
  return (
    <ActionFormShell
      form={form}
      action={saveTripAction.bind(null, org)}
      submit={entry ? "Save trip" : "Record trip"}
    >
      <AllocationAndReadings
        control={form.control}
        allocations={allocations}
        disabled={!!entry}
        meterLabel="odometer"
        baseCurrency={baseCurrency}
        setProjectId={(id) => form.setValue("projectId", id)}
      />
      <DateTimeField
        control={form.control}
        name="outAt"
        label="Departure date and time"
      />
      <DateTimeField
        control={form.control}
        name="inAt"
        label="Return date and time"
      />
      <NotesField control={form.control} />
    </ActionFormShell>
  );
}
