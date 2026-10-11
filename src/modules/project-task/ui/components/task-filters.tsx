"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField, type Option } from "@/components/shared/combobox";
import {
  ActionFormShell,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { enumOptions } from "@/components/shared/form/enum-options";
import { TaskStatus } from "@/generated/prisma/enums";
import { taskFiltersInput } from "../../schema";
import { findTaskStages } from "../../server/picker-actions";
export function TaskFilters({
  org,
  projectId,
  defaults,
  stages,
}: {
  org: string;
  projectId: string;
  defaults: z.input<typeof taskFiltersInput>;
  stages: Option[];
}) {
  const form = useZodForm(taskFiltersInput, defaults);
  const loadStages = useMemo(
    () => findTaskStages.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      className="grid items-end gap-4"
      submit="Filter tasks"
      action={async (input) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
        return {
          redirectTo: `/${org}/projects/${projectId}/tasks?${query.toString()}`,
        };
      }}
    >
      <div className="grid items-end gap-4 sm:grid-cols-4">
        <TextField control={form.control} name="search" label="Search tasks" />
        <ComboboxField
          control={form.control}
          name="status"
          label="Task status"
          options={enumOptions(TaskStatus)}
          clearable
          placeholder="All statuses"
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
      </div>
    </ActionFormShell>
  );
}
