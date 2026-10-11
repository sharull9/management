"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { NumberField } from "@/components/shared/form/number-field";
import { SelectField } from "@/components/shared/form/select-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { ProjectStatus } from "@/generated/prisma/enums";
import { findProjectMembers } from "@/modules/project/server/picker-actions";
import { deleteStageInput, stageFormInput } from "../../schema";
import { deleteStageAction, saveStageAction } from "../../server/actions";
export function StageForm({
  org,
  projectId,
  stage,
  users,
  nextSequence = 1,
}: {
  org: string;
  projectId: string;
  stage?: z.input<typeof stageFormInput>;
  users: { id: string; name: string }[];
  nextSequence?: number;
}) {
  const form = useZodForm<
    z.input<typeof stageFormInput>,
    z.output<typeof stageFormInput>
  >(
    stageFormInput,
    stage ?? {
      id: null,
      name: "",
      sequence: nextSequence,
      status: "PLANNED",
      managerUserId: null,
      budgetAmount: "",
      startDate: "",
      endDate: "",
    },
  );
  const loadMembers = useMemo(
    () => findProjectMembers.bind(null, org, projectId, "stage"),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={saveStageAction.bind(null, org, projectId)}
      submit={stage ? "Save stage" : "Create stage"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Stage name"
          required
        />
        <NumberField
          control={form.control}
          name="sequence"
          label="Sequence"
          min={1}
          required
        />
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          options={enumOptions(ProjectStatus)}
        />
        <SelectField
          control={form.control}
          name="managerUserId"
          label="Stage manager"
          options={toOptions(users)}
          loadOptions={loadMembers}
          clearable
        />
        <DateField control={form.control} name="startDate" label="Start date" />
        <DateField control={form.control} name="endDate" label="End date" />
        <TextField
          control={form.control}
          name="budgetAmount"
          label="Stage budget (optional)"
          inputMode="decimal"
        />
      </div>
    </ActionFormShell>
  );
}
export function DeleteStageForm({
  org,
  projectId,
  id,
}: {
  org: string;
  projectId: string;
  id: string;
}) {
  const form = useZodForm<
    z.input<typeof deleteStageInput>,
    z.output<typeof deleteStageInput>
  >(deleteStageInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={deleteStageAction.bind(null, org, projectId)}
      submit="Delete stage"
      destructive
    >
      <p className="text-xs text-muted-foreground">
        Referenced stages cannot be deleted.
      </p>
    </ActionFormShell>
  );
}
