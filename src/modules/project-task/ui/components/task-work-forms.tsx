"use client";
import { useMemo } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { taskOperationInput } from "../../schema";
import { findTaskWorkers } from "../../server/picker-actions";
import { taskOperationAction } from "../../server/work-actions";

type Scope = { org: string; projectId: string; taskId: string };
export function TaskStartForm(props: Scope) {
  const form = useZodForm(taskOperationInput, { operation: "START" });
  return (
    <ActionFormShell
      form={form}
      action={taskOperationAction.bind(
        null,
        props.org,
        props.projectId,
        props.taskId,
      )}
      submit="Start work"
    >
      {null}
    </ActionFormShell>
  );
}
export function TaskUnassignForm(props: Scope & { workerId: string }) {
  const form = useZodForm(taskOperationInput, {
    operation: "UNASSIGN",
    workerId: props.workerId,
  });
  return (
    <ActionFormShell
      form={form}
      action={taskOperationAction.bind(
        null,
        props.org,
        props.projectId,
        props.taskId,
      )}
      submit="Remove assignment"
      destructive
    >
      {null}
    </ActionFormShell>
  );
}
export function TaskAssignmentForm({
  org,
  projectId,
  taskId,
  workers,
}: Scope & { workers: Option[] }) {
  const form = useZodForm(taskOperationInput, {
    operation: "ASSIGN",
    workerIds: [],
    startDate: "",
    endDate: "",
  });
  const loadWorkers = useMemo(
    () => findTaskWorkers.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={taskOperationAction.bind(null, org, projectId, taskId)}
      submit="Assign workers"
    >
      <ComboboxField
        multiple
        control={form.control}
        name="workerIds"
        label="Project workers"
        options={workers}
        loadOptions={loadWorkers}
        queryKey={["task-workers", org, projectId]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          control={form.control}
          name="startDate"
          label="Assignment start"
        />
        <DateField
          control={form.control}
          name="endDate"
          label="Assignment end"
        />
      </div>
    </ActionFormShell>
  );
}
export function TaskDelayForm(props: Scope) {
  const form = useZodForm(taskOperationInput, {
    operation: "DELAY",
    reason: "",
    proposedDueDate: "",
  });
  return (
    <ActionFormShell
      form={form}
      action={taskOperationAction.bind(
        null,
        props.org,
        props.projectId,
        props.taskId,
      )}
      submit="Request delay approval"
    >
      <DateField
        control={form.control}
        name="proposedDueDate"
        label="Proposed due date"
      />
      <TextField control={form.control} name="reason" label="Delay reason" />
    </ActionFormShell>
  );
}
