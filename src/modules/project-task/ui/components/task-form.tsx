"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { TaskPriority } from "@/generated/prisma/enums";
import { saveTaskInput } from "../../schema";
import { saveTaskAction } from "../../server/actions";
import { findTaskStages } from "../../server/picker-actions";
export function TaskForm({
  org,
  projectId,
  task,
  stages,
}: {
  org: string;
  projectId: string;
  task?: z.input<typeof saveTaskInput>;
  stages: { id: string; name: string }[];
}) {
  const form = useZodForm<
    z.input<typeof saveTaskInput>,
    z.output<typeof saveTaskInput>
  >(
    saveTaskInput,
    task ?? {
      id: null,
      title: "",
      description: "",
      stageId: null,
      priority: "NORMAL",
      status: "TODO",
      progressPercent: 0,
      plannedStart: "",
      dueDate: "",
      estimatedHours: "",
    },
  );
  const loadStages = useMemo(
    () => findTaskStages.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={saveTaskAction.bind(null, org, projectId)}
      submit={task ? "Save task" : "Create task"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="title" label="Task title" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
        />
        <ComboboxField
          control={form.control}
          name="stageId"
          label="Stage"
          options={toOptions(stages)}
          loadOptions={loadStages}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="priority"
          label="Priority"
          options={enumOptions(TaskPriority)}
        />
        <ComboboxField
          control={form.control}
          name="status"
          label="Status"
          options={enumOptions({
            TODO: "TODO",
            IN_PROGRESS: "IN_PROGRESS",
            REWORK: "REWORK",
            CANCELLED: "CANCELLED",
          })}
        />
        <NumberField
          control={form.control}
          name="progressPercent"
          label="Progress (%)"
          min={0}
          max={100}
        />
        <DateField
          control={form.control}
          name="plannedStart"
          label="Planned start"
        />
        <DateField control={form.control} name="dueDate" label="Due date" />
        <TextField
          control={form.control}
          name="estimatedHours"
          label="Estimated hours"
          inputMode="decimal"
        />
      </div>
    </ActionFormShell>
  );
}
