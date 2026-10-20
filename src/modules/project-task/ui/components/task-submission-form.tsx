"use client";
import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { ActionForm } from "@/components/shared/action-form";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  MAX_TASK_PHOTO_COUNT,
  MAX_TASK_PHOTO_TOTAL_BYTES,
  taskPhotoUploadError,
  taskSubmissionInput,
} from "../../schema";
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
  const [photoError, setPhotoError] = useState<string>();
  const [photoTotal, setPhotoTotal] = useState(0);
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
        queryKey={["submission-workers", org, projectId, taskId]}
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
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            const error = taskPhotoUploadError(files);
            event.currentTarget.setCustomValidity(error ?? "");
            setPhotoTotal(files.reduce((total, file) => total + file.size, 0));
            setPhotoError(error);
          }}
          aria-invalid={!!photoError}
          aria-describedby="work-photo-limits work-photo-error"
        />
        <p id="work-photo-limits" className="text-sm text-muted-foreground">
          Up to {MAX_TASK_PHOTO_COUNT} JPEG, PNG or WebP photos, 900 KB each and{" "}
          900 KB total. {Math.ceil(photoTotal / 1024)} /{" "}
          {Math.floor(MAX_TASK_PHOTO_TOTAL_BYTES / 1024)} KB selected.
        </p>
        {photoError && (
          <p
            id="work-photo-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {photoError}
          </p>
        )}
      </Field>
    </ActionForm>
  );
}
