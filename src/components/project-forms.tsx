import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import { MaterialCostRecognitionFields } from "@/components/shared/material-cost-recognition-fields";
import type { Project, Stage, Task, Worker } from "@/generated/prisma/client";
import { PayType, ProjectStatus, TaskPriority } from "@/generated/prisma/enums";
import {
  saveProjectAction,
  saveProjectCostRecognitionAction,
  saveStageAction,
  saveTaskAction,
  saveWorkerAction,
} from "@/server/projects/actions";

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
export function ProjectCostRecognitionForm({
  org,
  project,
}: {
  org: string;
  project: Project;
}) {
  return (
    <ActionForm
      action={saveProjectCostRecognitionAction.bind(null, org, project.id)}
      submit="Save material cost setting"
    >
      <MaterialCostRecognitionFields
        mode={project.materialCostRecognition}
        existingProject
      />
    </ActionForm>
  );
}
export function StageForm({
  org,
  projectId,
  stage,
  users,
  nextSequence = 1,
}: {
  org: string;
  projectId: string;
  stage?: Stage;
  users: { id: string; name: string }[];
  nextSequence?: number;
}) {
  return (
    <ActionForm
      action={saveStageAction.bind(null, org, projectId)}
      submit={stage ? "Save stage" : "Create stage"}
    >
      {stage && <input type="hidden" name="id" value={stage.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Stage name"
          name="name"
          defaultValue={stage?.name}
          required
        />
        <Field
          label="Sequence"
          name="sequence"
          type="number"
          min={1}
          defaultValue={stage?.sequence ?? nextSequence}
          required
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={stage?.status ?? "PLANNED"}
        >
          <EnumOptions values={ProjectStatus} />
        </SelectField>
        <SelectField
          label="Stage manager"
          name="managerUserId"
          defaultValue={stage?.managerUserId ?? ""}
        >
          <Options rows={users} />
        </SelectField>
        <Field
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={dateValue(stage?.startDate)}
        />
        <Field
          label="End date"
          name="endDate"
          type="date"
          defaultValue={dateValue(stage?.endDate)}
        />
        <Field
          label="Stage budget (optional)"
          name="budgetAmount"
          inputMode="decimal"
          defaultValue={stage?.budgetAmount?.toFixed(2) ?? ""}
        />
      </div>
    </ActionForm>
  );
}
export function TaskForm({
  org,
  projectId,
  task,
  stages,
}: {
  org: string;
  projectId: string;
  task?: Task;
  stages: { id: string; name: string }[];
}) {
  return (
    <ActionForm
      action={saveTaskAction.bind(null, org, projectId)}
      submit={task ? "Save task" : "Create task"}
    >
      {task && <input type="hidden" name="id" value={task.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Task title"
          name="title"
          defaultValue={task?.title}
          required
        />
        <Field
          label="Description"
          name="description"
          defaultValue={task?.description ?? ""}
        />
        <SelectField
          label="Stage"
          name="stageId"
          defaultValue={task?.stageId ?? ""}
        >
          <Options rows={stages} />
        </SelectField>
        <SelectField
          label="Priority"
          name="priority"
          defaultValue={task?.priority ?? "NORMAL"}
        >
          <EnumOptions values={TaskPriority} />
        </SelectField>
        <SelectField
          label="Status"
          name="status"
          defaultValue={task?.status ?? "TODO"}
        >
          {["TODO", "IN_PROGRESS", "REWORK", "CANCELLED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <Field
          label="Progress (%)"
          name="progressPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={task?.progressPercent ?? 0}
          required
        />
        <Field
          label="Planned start"
          name="plannedStart"
          type="date"
          defaultValue={dateValue(task?.plannedStart)}
        />
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          defaultValue={dateValue(task?.dueDate)}
        />
        <Field
          label="Estimated hours"
          name="estimatedHours"
          inputMode="decimal"
          defaultValue={task?.estimatedHours?.toString() ?? ""}
        />
      </div>
    </ActionForm>
  );
}
export function WorkerForm({
  org,
  worker,
  designations,
}: {
  org: string;
  worker?: Worker;
  designations: { id: string; name: string }[];
}) {
  return (
    <ActionForm
      action={saveWorkerAction.bind(null, org)}
      submit={worker ? "Save worker" : "Create worker"}
    >
      {worker && <input type="hidden" name="id" value={worker.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Worker name"
          name="name"
          defaultValue={worker?.name}
          required
        />
        <Field label="Phone" name="phone" defaultValue={worker?.phone ?? ""} />
        <SelectField
          label="Designation"
          name="designationId"
          defaultValue={worker?.designationId ?? ""}
        >
          <Options rows={designations} />
        </SelectField>
        <SelectField
          label="Pay type"
          name="payType"
          defaultValue={worker?.payType ?? "MONTHLY"}
        >
          <EnumOptions values={PayType} />
        </SelectField>
        <Field
          label="Salary / daily / hourly pay"
          name="salaryAmount"
          inputMode="decimal"
          defaultValue={worker?.salaryAmount.toFixed(2) ?? "0.00"}
          required
        />
        <Field
          label="Cost days per month"
          name="costDaysPerMonth"
          inputMode="decimal"
          defaultValue={worker?.costDaysPerMonth.toString() ?? "30"}
          required
        />
        <Field
          label="Standard hours per day"
          name="standardHoursPerDay"
          inputMode="decimal"
          defaultValue={worker?.standardHoursPerDay.toString() ?? "8"}
          required
        />
        <Field
          label="Overtime multiplier"
          name="overtimeMultiplier"
          inputMode="decimal"
          defaultValue={worker?.overtimeMultiplier.toString() ?? "1.5"}
          required
        />
        <Field
          label="Join date"
          name="joinDate"
          type="date"
          defaultValue={dateValue(worker?.joinDate)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={worker?.active ?? true}
          />
          Active
        </label>
      </div>
    </ActionForm>
  );
}
