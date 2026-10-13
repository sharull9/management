"use client";
import { useEffect, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CostTypeField } from "@/components/shared/form/cost-type-field";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { findCurrencies } from "@/modules/currency/server/picker-actions";
import { createExpenseInput } from "../../schema";
import { expenseAction } from "../../server/actions";
import {
  expenseFx,
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
  const loadCurrencies = useMemo(() => findCurrencies.bind(null, org), [org]);
  const currency = useWatch({ control: form.control, name: "currency" });
  const expenseDate = useWatch({ control: form.control, name: "date" });
  const [rateNote, setRateNote] = useState<string | null>(null);
  const { setValue } = form;
  useEffect(() => {
    if (!currency || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return;
    if (currency === baseCurrency) {
      setValue("exchangeRate", "1");
      setRateNote(null);
      return;
    }
    let stale = false;
    expenseFx(org, projectId, currency, expenseDate)
      .then((fx) => {
        if (stale) return;
        setValue("exchangeRate", fx.exchangeRate ?? "");
        setRateNote(fx.message);
      })
      .catch(() => {
        if (!stale) setRateNote("Could not load the exchange rate.");
      });
    return () => {
      stale = true;
    };
  }, [currency, expenseDate, baseCurrency, org, projectId, setValue]);
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
        <ComboboxField
          control={form.control}
          name="currency"
          label="Currency"
          description={
            currency === projectCurrency
              ? "Project currency"
              : `Posted to the project in ${projectCurrency}`
          }
          options={currencies}
          loadOptions={loadCurrencies}
          queryKey={["currencies", org]}
        />
        <TextField
          control={form.control}
          name="amount"
          label={`Expense amount (${currency || projectCurrency})`}
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="exchangeRate"
          label={`Exchange rate (${baseCurrency} per 1 ${currency || projectCurrency})`}
          description={
            rateNote ??
            (currency === baseCurrency
              ? "Base currency, rate is 1."
              : "Dated rate for the expense date. You can override it.")
          }
          inputMode="decimal"
          disabled={currency === baseCurrency}
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
  );
}
