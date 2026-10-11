"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField, type Option } from "@/components/shared/combobox";
import {
  ActionFormShell,
  CostTypeField,
  DateField,
  useZodForm,
} from "@/components/shared/form";
import { costFiltersInput } from "../../schema";
import { findCostStages } from "../../server/picker-actions";
export function CostFilters({
  org,
  projectId,
  defaults,
  stages,
}: {
  org: string;
  projectId: string;
  defaults: z.input<typeof costFiltersInput>;
  stages: Option[];
}) {
  const form = useZodForm(costFiltersInput, defaults);
  const loadStages = useMemo(
    () => findCostStages.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      className="grid items-end gap-4"
      submit="Filter ledger"
      action={async (input) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
        return {
          redirectTo: `/${org}/projects/${projectId}/costs?${query.toString()}`,
        };
      }}
    >
      <div className="grid items-end gap-4 sm:grid-cols-5">
        <CostTypeField
          control={form.control}
          name="costType"
          label="Cost type filter"
          clearable
          placeholder="All types"
        />
        <ComboboxField
          control={form.control}
          name="stageId"
          label="Stage filter"
          options={stages}
          loadOptions={loadStages}
          clearable
          placeholder="All stages"
        />
        <DateField control={form.control} name="from" label="From date" />
        <DateField control={form.control} name="to" label="To date" />
      </div>
    </ActionFormShell>
  );
}
