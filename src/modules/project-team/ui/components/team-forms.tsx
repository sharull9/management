"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { DateField } from "@/components/shared/form/date-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { findProjectMembers } from "@/modules/project/server/picker-actions";
import { memberInput, workerInput } from "../../schema";
import { saveWorkerAction, teamAction } from "../../server/actions";
import { findWorkers } from "../../server/picker-actions";

type Choice = { id: string; name: string };
export function MemberForm({
  org,
  projectId,
  users,
  roles,
}: {
  org: string;
  projectId: string;
  users: Choice[];
  roles: Choice[];
}) {
  const form = useZodForm<
    z.input<typeof memberInput>,
    z.output<typeof memberInput>
  >(memberInput, {
    userId: null,
    roleId: null,
    isManager: false,
  });
  const loadMembers = useMemo(
    () => findProjectMembers.bind(null, org, projectId, "team"),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={teamAction.bind(null, org, projectId)}
      submit="Save member"
    >
      <ComboboxField
        control={form.control}
        name="userId"
        label="Organization member"
        options={toOptions(users)}
        loadOptions={loadMembers}
      />
      <ComboboxField
        control={form.control}
        name="roleId"
        label="Project role"
        options={toOptions(roles)}
        clearable
      />
      <CheckboxField
        control={form.control}
        name="isManager"
        label="Project manager"
      />
    </ActionFormShell>
  );
}
export function WorkerForm({
  org,
  projectId,
  assignment,
  workers,
}: {
  org: string;
  projectId: string;
  assignment?: z.input<typeof workerInput>;
  workers: Choice[];
}) {
  const form = useZodForm<
    z.input<typeof workerInput>,
    z.output<typeof workerInput>
  >(
    workerInput,
    assignment ?? {
      id: null,
      workerId: null,
      startDate: "",
      endDate: "",
      dayRateOverride: "",
      otHourlyRateOverride: "",
      notes: "",
      confirmOverlap: false,
    },
  );
  const loadWorkers = useMemo(
    () => findWorkers.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={saveWorkerAction.bind(null, org, projectId)}
      submit={assignment ? "Save assignment" : "Assign worker"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ComboboxField
          control={form.control}
          name="workerId"
          label="Worker"
          options={toOptions(workers)}
          loadOptions={loadWorkers}
          disabled={!!assignment}
        />
        <DateField control={form.control} name="startDate" label="Start date" />
        <DateField control={form.control} name="endDate" label="End date" />
        <TextField
          control={form.control}
          name="dayRateOverride"
          label="Day rate override"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="otHourlyRateOverride"
          label="OT hourly rate override"
          inputMode="decimal"
        />
        <TextField control={form.control} name="notes" label="Notes" />
      </div>
      <p className="text-sm text-muted-foreground">
        Overlapping project dates produce a warning. Review availability in
        Workforce before confirming.
      </p>
      <CheckboxField
        control={form.control}
        name="confirmOverlap"
        label="Confirm overlapping assignments"
      />
    </ActionFormShell>
  );
}
