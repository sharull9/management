"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField, type Option } from "@/components/shared/combobox";
import {
  ActionFormShell,
  DateField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { workforceFiltersInput } from "../../schema";
import { findWorkforceWorkers } from "../../server/picker-actions";
export function WorkforceFilters({
  org,
  defaults,
  workers,
}: {
  org: string;
  defaults: z.input<typeof workforceFiltersInput>;
  workers: Option[];
}) {
  const form = useZodForm(workforceFiltersInput, defaults);
  const loadWorkers = useMemo(
    () => findWorkforceWorkers.bind(null, org),
    [org],
  );
  return (
    <ActionFormShell
      form={form}
      className="grid items-end gap-4"
      submit="Check availability"
      action={async (input) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
        return { redirectTo: `/${org}/workforce?${query.toString()}` };
      }}
    >
      <div className="grid items-end gap-4 sm:grid-cols-5">
        <TextField
          control={form.control}
          name="search"
          label="Search workers"
        />
        <ComboboxField
          control={form.control}
          name="workerId"
          label="Worker filter"
          options={workers}
          loadOptions={loadWorkers}
          clearable
          placeholder="All workers"
        />
        <DateField control={form.control} name="from" label="Available from" />
        <DateField control={form.control} name="to" label="Available to" />
      </div>
    </ActionFormShell>
  );
}
