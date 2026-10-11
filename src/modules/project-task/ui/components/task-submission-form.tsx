"use client";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { ActionForm } from "@/components/shared/action-form";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { taskSubmissionInput } from "../../schema";
import { findSubmissionWorkers } from "../../server/picker-actions";
import { taskWorkAction } from "../../server/work-actions";
export function TaskSubmissionForm({
  org,
  projectId,
  taskId,
  progressPercent,
  workers,
}: {
  org: string;
  projectId: string;
  taskId: string;
  progressPercent: number;
  workers: Option[];
}) {
  const form = useZodForm(taskSubmissionInput, {
    note: "",
    progressPercent,
    onBehalfOfWorkerId: null,
  });
  const workerId = useWatch({
    control: form.control,
    name: "onBehalfOfWorkerId",
  });
  const loadWorkers = useMemo(
    () => findSubmissionWorkers.bind(null, org, projectId, taskId),
    [org, projectId, taskId],
  );
  return (
    <ActionForm
      action={taskWorkAction.bind(null, org, projectId, taskId)}
      submit="Submit for approval"
    >
      <input type="hidden" name="operation" value="SUBMIT" />
      <input type="hidden" name="onBehalfOfWorkerId" value={workerId ?? ""} />
      <TextField
        control={form.control}
        name="note"
        label="Work note"
        required
      />
      <NumberField
        control={form.control}
        name="progressPercent"
        label="Progress percent"
        min={0}
        max={100}
        required
      />
      <ComboboxField
        control={form.control}
        name="onBehalfOfWorkerId"
        label="On behalf of worker"
        options={workers}
        loadOptions={loadWorkers}
        clearable
        placeholder="Submitted by me"
      />
      <Field>
        <FieldLabel htmlFor="work-photos">Work photos</FieldLabel>
        <Input
          id="work-photos"
          name="attachments"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
        />
      </Field>
    </ActionForm>
  );
}
