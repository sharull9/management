import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import type { Worker } from "@/generated/prisma/client";
import { PayType } from "@/generated/prisma/enums";
import { saveWorkerAction } from "../../server/actions";
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
