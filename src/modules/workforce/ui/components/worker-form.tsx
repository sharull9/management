"use client";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { DateField } from "@/components/shared/form/date-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { PayType } from "@/generated/prisma/enums";
import { saveWorkerInput } from "../../schema";
import { saveWorkerAction } from "../../server/actions";
export function WorkerForm({
  org,
  worker,
  designations,
}: {
  org: string;
  worker?: z.input<typeof saveWorkerInput>;
  designations: { id: string; name: string }[];
}) {
  const form = useZodForm<
    z.input<typeof saveWorkerInput>,
    z.output<typeof saveWorkerInput>
  >(
    saveWorkerInput,
    worker ?? {
      id: null,
      name: "",
      phone: "",
      designationId: null,
      payType: "MONTHLY",
      salaryAmount: "0.00",
      costDaysPerMonth: "30",
      standardHoursPerDay: "8",
      overtimeMultiplier: "1.5",
      joinDate: "",
      active: true,
    },
  );
  return (
    <ActionFormShell
      form={form}
      action={saveWorkerAction.bind(null, org)}
      submit={worker ? "Save worker" : "Create worker"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="name" label="Worker name" />
        <TextField control={form.control} name="phone" label="Phone" />
        <ComboboxField
          control={form.control}
          name="designationId"
          label="Designation"
          options={toOptions(designations)}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="payType"
          label="Pay type"
          options={enumOptions(PayType)}
        />
        <TextField
          control={form.control}
          name="salaryAmount"
          label="Salary / daily / hourly pay"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="costDaysPerMonth"
          label="Cost days per month"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="standardHoursPerDay"
          label="Standard hours per day"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="overtimeMultiplier"
          label="Overtime multiplier"
          inputMode="decimal"
        />
        <DateField control={form.control} name="joinDate" label="Join date" />
        <CheckboxField control={form.control} name="active" label="Active" />
      </div>
    </ActionFormShell>
  );
}
