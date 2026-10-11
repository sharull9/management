"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { ApproverType, DocumentType } from "@/generated/prisma/enums";
import { savePolicyInput } from "../../schema";
import { savePolicyAction } from "../../server/actions";
import {
  findApprovalProjects,
  findApprovalRoles,
  findApprovalStages,
  findApprovalUsers,
} from "../../server/picker-actions";
import type { PolicyDraft, PolicyOptions } from "../../type";

const defaultStep: PolicyDraft["steps"][number] = {
  name: "Approval",
  approverType: "PROJECT_MANAGER",
  roleId: null,
  userId: null,
  minAmount: "",
};
const emptyOptions: PolicyOptions = {
  roles: [],
  users: [],
  projects: [],
  stages: [],
};
const documentTypes = enumOptions(DocumentType);
const approverTypes = enumOptions(ApproverType);
const scopes = [
  { value: "org", label: "Organization default" },
  { value: "project", label: "Project" },
  { value: "stage", label: "Stage" },
];

export function PolicyEditor({
  org,
  draft,
  options = emptyOptions,
}: {
  org: string;
  draft?: PolicyDraft;
  options?: PolicyOptions;
}) {
  const form = useZodForm<PolicyDraft, z.output<typeof savePolicyInput>>(
    savePolicyInput,
    draft ?? {
      id: null,
      name: "",
      documentType: Object.values(DocumentType)[0],
      active: true,
      scope: "org",
      projectId: null,
      stageId: null,
      steps: [defaultStep],
    },
  );
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });
  const [scope, projectId, steps] = useWatch({
    control: form.control,
    name: ["scope", "projectId", "steps"],
  });
  const previousProject = useRef(projectId);
  useEffect(() => {
    if (previousProject.current !== projectId) {
      form.setValue("stageId", null, { shouldDirty: true });
      previousProject.current = projectId;
    }
  }, [form, projectId]);
  const roles = useMemo(() => findApprovalRoles.bind(null, org), [org]);
  const users = useMemo(() => findApprovalUsers.bind(null, org), [org]);
  const projects = useMemo(() => findApprovalProjects.bind(null, org), [org]);
  const stages = useMemo(
    () => findApprovalStages.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={savePolicyAction.bind(null, org)}
      submit={draft ? "Save policy" : "Create policy"}
    >
      <TextField control={form.control} name="name" label="Policy name" />
      <ComboboxField
        control={form.control}
        name="documentType"
        label="Document type"
        options={documentTypes}
      />
      <CheckboxField control={form.control} name="active" label="Active" />
      <div className="grid gap-4 sm:grid-cols-3">
        <ComboboxField
          control={form.control}
          name="scope"
          label="Policy scope"
          options={scopes}
        />
        <ComboboxField
          control={form.control}
          name="projectId"
          label="Project"
          options={options.projects}
          loadOptions={projects}
          queryKey={["approval-projects", org]}
          disabled={scope === "org"}
          clearable
          searchPlaceholder="Search projects"
        />
        <ComboboxField
          key={projectId}
          control={form.control}
          name="stageId"
          label="Stage"
          options={projectId === draft?.projectId ? options.stages : []}
          loadOptions={stages}
          queryKey={["approval-stages", org, projectId]}
          disabled={scope !== "stage" || !projectId}
          clearable
          searchPlaceholder="Search stages"
        />
      </div>
      {fields.map((field, index) => (
        <fieldset key={field.id} className="rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">Step {index + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name={`steps.${index}.name`}
              label="Step name"
            />
            <ComboboxField
              control={form.control}
              name={`steps.${index}.approverType`}
              label="Approver type"
              options={approverTypes}
            />
            {steps[index]?.approverType === "ROLE" && (
              <ComboboxField
                control={form.control}
                name={`steps.${index}.roleId`}
                label="Custom role"
                options={options.roles}
                loadOptions={roles}
                queryKey={["approval-roles", org]}
                clearable
                searchPlaceholder="Search roles"
              />
            )}
            {steps[index]?.approverType === "USER" && (
              <ComboboxField
                control={form.control}
                name={`steps.${index}.userId`}
                label="Approver"
                options={options.users}
                loadOptions={users}
                queryKey={["approval-users", org]}
                clearable
                searchPlaceholder="Search members"
              />
            )}
            <TextField
              control={form.control}
              name={`steps.${index}.minAmount`}
              label="Minimum amount (optional)"
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Move step ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Move step ${index + 1} down`}
              disabled={index === fields.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fields.length === 1}
              onClick={() => remove(index)}
            >
              <Trash2 />
              Remove
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={fields.length >= 20}
        onClick={() => append(defaultStep)}
      >
        <Plus />
        Add step
      </Button>
      <p className="text-xs text-muted-foreground">
        Manager steps resolve project or stage managers. When no manager is set,
        organization or tenant administrators can act.
      </p>
    </ActionFormShell>
  );
}
