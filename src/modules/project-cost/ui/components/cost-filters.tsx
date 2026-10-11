"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CostTypeField } from "@/components/shared/form/cost-type-field";
import { DateField } from "@/components/shared/form/date-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
        const query = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
          else query.delete(key);
        router.replace(
          `/${org}/projects/${projectId}/costs?${query.toString()}`,
          { scroll: false },
        );
        return {};
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
