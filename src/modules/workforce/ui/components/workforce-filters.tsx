"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
        const query = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
          else query.delete(key);
        router.replace(`/${org}/workforce?${query.toString()}`, {
          scroll: false,
        });
        return {};
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
