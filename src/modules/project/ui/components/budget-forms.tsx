"use client";
import type { z } from "zod";
import {
  ActionFormShell,
  CostTypeField,
  SelectField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { toOptions } from "@/components/shared/form/enum-options";
import { budgetLineInput, deleteInput, totalBudgetInput } from "../../schema";
import {
  budgetAction,
  deleteBudgetAction,
  totalBudgetAction,
} from "../../server/budget-actions";
export function BudgetLineForm({
  org,
  projectId,
  line,
  stages,
}: {
  org: string;
  projectId: string;
  line?: z.input<typeof budgetLineInput>;
  stages: { id: string; name: string }[];
}) {
  const form = useZodForm<
    z.input<typeof budgetLineInput>,
    z.output<typeof budgetLineInput>
  >(
    budgetLineInput,
    line ?? {
      id: null,
      costType: "LABOUR",
      stageId: null,
      amount: "",
      note: "",
    },
  );
  return (
    <ActionFormShell
      form={form}
      action={budgetAction.bind(null, org, projectId)}
      submit={line ? "Save line" : "Add budget line"}
    >
      <CostTypeField control={form.control} name="costType" />
      <SelectField
        control={form.control}
        name="stageId"
        label="Budget stage"
        options={toOptions(stages)}
        clearable
      />
      <TextField
        control={form.control}
        name="amount"
        label="Line amount"
        inputMode="decimal"
        required
      />
      <TextField control={form.control} name="note" label="Line note" />
    </ActionFormShell>
  );
}
export function TotalBudgetForm({
  org,
  projectId,
  budgetAmount,
}: {
  org: string;
  projectId: string;
  budgetAmount: string;
}) {
  const form = useZodForm<
    z.input<typeof totalBudgetInput>,
    z.output<typeof totalBudgetInput>
  >(totalBudgetInput, { budgetAmount });
  return (
    <ActionFormShell
      form={form}
      action={totalBudgetAction.bind(null, org, projectId)}
      submit="Save total budget"
    >
      <TextField
        control={form.control}
        name="budgetAmount"
        label="Total budget"
        inputMode="decimal"
        required
      />
    </ActionFormShell>
  );
}
export function DeleteBudgetForm({
  org,
  projectId,
  id,
}: {
  org: string;
  projectId: string;
  id: string;
}) {
  const form = useZodForm<
    z.input<typeof deleteInput>,
    z.output<typeof deleteInput>
  >(deleteInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={deleteBudgetAction.bind(null, org, projectId)}
      submit="Delete budget line"
      destructive
    >
      {null}
    </ActionFormShell>
  );
}
