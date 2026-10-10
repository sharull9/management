import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import { MaterialCostRecognitionFields } from "@/components/shared/material-cost-recognition-fields";
import type { Project } from "@/generated/prisma/client";
import { ProjectStatus } from "@/generated/prisma/enums";
import { saveProjectAction } from "../../server/actions";
export function ProjectForm({
  org,
  project,
  currency,
  customers,
  users,
}: {
  org: string;
  project?: Project;
  currency: string;
  customers: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  return (
    <ActionForm
      action={saveProjectAction.bind(null, org)}
      submit={project ? "Save project" : "Create project"}
    >
      {project && <input type="hidden" name="id" value={project.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Project name"
          name="name"
          defaultValue={project?.name}
          required
          maxLength={150}
        />
        <Field
          label="Description"
          name="description"
          defaultValue={project?.description ?? ""}
        />
        <SelectField
          label="Client"
          name="clientPartyId"
          defaultValue={project?.clientPartyId ?? ""}
        >
          <Options rows={customers} />
        </SelectField>
        <SelectField
          label="Manager"
          name="managerUserId"
          defaultValue={project?.managerUserId ?? ""}
        >
          <Options rows={users} />
        </SelectField>
        <SelectField
          label="Status"
          name="status"
          defaultValue={project?.status ?? "PLANNED"}
        >
          <EnumOptions values={ProjectStatus} />
        </SelectField>
        <Field
          label="Budget"
          name="budgetAmount"
          inputMode="decimal"
          defaultValue={project?.budgetAmount.toFixed(2) ?? "0.00"}
          required
        />
        <Field
          label="Currency"
          name="currency"
          defaultValue={project?.currency ?? currency}
          maxLength={3}
          required
        />
        <Field
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={dateValue(project?.startDate)}
        />
        <Field
          label="End date"
          name="endDate"
          type="date"
          defaultValue={dateValue(project?.endDate)}
        />
      </div>
      <MaterialCostRecognitionFields
        mode={project?.materialCostRecognition}
        existingProject={!!project}
      />
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm">Create a customer</summary>
        <a className="text-sm underline" href={`/${org}/masters/parties`}>
          Manage customers and vendor details in Parties
        </a>
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <Field label="Customer display name" name="customerName" />
          <Field label="Customer legal name" name="customerLegalName" />
        </div>
      </details>
    </ActionForm>
  );
}
