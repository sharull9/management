"use client";

import { useFieldArray } from "react-hook-form";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CostTypeField } from "@/components/shared/form/cost-type-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { budgetLinesInput } from "../../schema";
import { budgetLinesAction } from "../../server/budget-actions";

const emptyLine = {
  costType: "LABOUR" as const,
  stageId: null,
  amount: "",
  note: "",
};

export function BudgetLinesForm({
  org,
  projectId,
  stages,
}: {
  org: string;
  projectId: string;
  stages: { id: string; name: string }[];
}) {
  const form = useZodForm(budgetLinesInput, { lines: [emptyLine] });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  return (
    <ActionFormShell
      form={form}
      action={budgetLinesAction.bind(null, org, projectId)}
      submit="Add budget lines"
    >
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-4 rounded-md border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CostTypeField
              control={form.control}
              name={`lines.${index}.costType`}
            />
            <ComboboxField
              control={form.control}
              name={`lines.${index}.stageId`}
              label="Budget stage"
              options={toOptions(stages)}
              clearable
            />
            <TextField
              control={form.control}
              name={`lines.${index}.amount`}
              label="Line amount"
              inputMode="decimal"
              required
            />
            <TextField
              control={form.control}
              name={`lines.${index}.note`}
              label="Line note"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={fields.length === 1}
            onClick={() => remove(index)}
            aria-label={`Remove budget line ${index + 1}`}
          >
            Remove line
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={fields.length >= 100}
        onClick={() => append({ ...emptyLine })}
      >
        Add another line
      </Button>
    </ActionFormShell>
  );
}
