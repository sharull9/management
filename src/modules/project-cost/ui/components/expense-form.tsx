"use client";
import { useMemo } from "react";
import { FormProvider, useWatch } from "react-hook-form";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CostTypeField } from "@/components/shared/form/cost-type-field";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { CurrencyFxFields } from "@/modules/currency/ui/components/currency-fx-fields";
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
  projectCurrency,
  baseCurrency,
  currencies,
}: {
  org: string;
  projectId: string;
  date: string;
  stages: Option[];
  tasks: Option[];
  parties: Option[];
  projectCurrency: string;
  baseCurrency: string;
  currencies: Option[];
}) {
  const form = useZodForm(createExpenseInput, {
    date,
    costType: "OTHER",
    currency: projectCurrency,
    exchangeRate: "",
    amount: "",
    description: "",
    stageId: null,
    taskId: null,
    partyId: null,
  });
  const currency = useWatch({ control: form.control, name: "currency" });
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
    <FormProvider {...form}>
      <ActionFormShell
        form={form}
        action={expenseAction.bind(null, org, projectId)}
        submit="Submit expense for approval"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField control={form.control} name="date" label="Expense date" />
          <CostTypeField control={form.control} name="costType" />
          <CurrencyFxFields
            org={org}
            baseCurrency={baseCurrency}
            currencyOptions={currencies}
            currencyDescription={
              currency === projectCurrency
                ? "Project currency"
                : `Posted to the project in ${projectCurrency}`
            }
            subject="expense"
          />
          <TextField
            control={form.control}
            name="amount"
            label={`Expense amount (${currency || projectCurrency})`}
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
            queryKey={["cost-stages", org, projectId]}
            clearable
          />
          <ComboboxField
            control={form.control}
            name="taskId"
            label="Expense task"
            options={tasks}
            loadOptions={loadTasks}
            queryKey={["expense-tasks", org, projectId]}
            clearable
          />
          <ComboboxField
            control={form.control}
            name="partyId"
            label="Expense party"
            options={parties}
            loadOptions={loadParties}
            queryKey={["expense-parties", org, projectId]}
            clearable
          />
        </div>
      </ActionFormShell>
    </FormProvider>
  );
}
