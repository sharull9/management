import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import type { Task } from "@/generated/prisma/client";
import { TaskPriority } from "@/generated/prisma/enums";
import { saveTaskAction } from "../../server/actions";
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
