"use client";
import { useMemo } from "react";
import { ComboboxField, type Option } from "@/components/shared/combobox";
import {
  ActionFormShell,
  CostTypeField,
  DateField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { createExpenseInput } from "../../schema";
import { expenseAction } from "../../server/actions";
import {
  findCostStages,
  findExpenseParties,
  findExpenseTasks,
} from "../../server/picker-actions";
export function ExpenseForm({
  org,
  projectId,
  date,
  stages,
  tasks,
  parties,
}: {
  org: string;
  projectId: string;
  date: string;
  stages: Option[];
  tasks: Option[];
  parties: Option[];
}) {
  const form = useZodForm(createExpenseInput, {
    date,
    costType: "OTHER",
    amount: "",
    description: "",
    stageId: null,
    taskId: null,
    partyId: null,
  });
  const loadStages = useMemo(
    () => findCostStages.bind(null, org, projectId),
    [org, projectId],
  );
  const loadTasks = useMemo(
    () => findExpenseTasks.bind(null, org, projectId),
    [org, projectId],
  );
  const loadParties = useMemo(
    () => findExpenseParties.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={expenseAction.bind(null, org, projectId)}
      submit="Submit expense for approval"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField control={form.control} name="date" label="Expense date" />
        <CostTypeField control={form.control} name="costType" />
        <TextField
          control={form.control}
          name="amount"
          label="Expense amount"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="description"
          label="Expense description"
        />
        <ComboboxField
          control={form.control}
          name="stageId"
          label="Expense stage"
          options={stages}
          loadOptions={loadStages}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="taskId"
          label="Expense task"
          options={tasks}
          loadOptions={loadTasks}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="partyId"
          label="Expense party"
          options={parties}
          loadOptions={loadParties}
          clearable
        />
      </div>
    </ActionFormShell>
  );
}
