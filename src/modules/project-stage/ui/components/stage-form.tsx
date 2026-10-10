import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import type { Stage } from "@/generated/prisma/client";
import { ProjectStatus } from "@/generated/prisma/enums";
import { saveStageAction } from "../../server/actions";
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
