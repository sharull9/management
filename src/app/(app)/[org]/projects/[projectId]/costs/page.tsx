import { Suspense } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { CostTypeField } from "@/components/shared/cost-type-field";
import { DataTable } from "@/components/shared/data-table";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import Loading from "@/components/shared/page-loading";
import { Button } from "@/components/ui/button";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { Prisma } from "@/generated/prisma/client";
import { CostType } from "@/generated/prisma/enums";
import { expenseAction } from "@/server/projects/actions";
import { readDate } from "@/server/projects/queries";

async function Costs({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<{
    costType?: string;
    stageId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { org, projectId } = await params;
  const ctx = await requireProjectContext(org, projectId);
  const canCost = ctx.isAdmin || ctx.permissions.has("cost.view");
  if (!canCost) assertPermission(ctx, "expense.create");
  const filters = await searchParams;
  const [ledger, stages, tasks, parties, expenses] = await Promise.all([
    canCost
      ? db.costEntry.findMany({
          where: {
            projectId,
            ...(Object.values(CostType).includes(filters.costType as CostType)
              ? { costType: filters.costType as CostType }
              : {}),
            ...(filters.stageId ? { stageId: filters.stageId } : {}),
            date: {
              ...(filters.from
                ? { gte: readDate(filters.from, new Date("1900-01-01")) }
                : {}),
              ...(filters.to
                ? { lte: readDate(filters.to, new Date("2100-01-01")) }
                : {}),
            },
          },
          include: { stage: true, task: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    db.stage.findMany({ where: { projectId } }),
    db.task.findMany({ where: { projectId } }),
    db.party.findMany({ where: { tenantId: ctx.tenant.id } }),
    db.expense.findMany({
      where: { projectId, ...(canCost ? {} : { createdById: ctx.user.id }) },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const total = ledger.reduce(
    (sum, c) => sum.add(c.amount),
    new Prisma.Decimal(0),
  );
  return (
    <>
      <h2 className="text-lg font-medium">Costs</h2>
      <form className="grid items-end gap-4 sm:grid-cols-5">
        <SelectField
          label="Cost type filter"
          name="costType"
          defaultValue={filters.costType ?? ""}
        >
          <option value="">All types</option>
          <EnumOptions values={CostType} />
        </SelectField>
        <SelectField
          label="Stage filter"
          name="stageId"
          defaultValue={filters.stageId ?? ""}
        >
          <Options rows={stages} empty="All stages" />
        </SelectField>
        <Field
          label="From date"
          name="from"
          type="date"
          defaultValue={filters.from}
        />
        <Field
          label="To date"
          name="to"
          type="date"
          defaultValue={filters.to}
        />
        <Button type="submit">Filter ledger</Button>
      </form>
      {canCost && (
        <FormCard
          title={`Cost ledger · ${ctx.project.currency} ${total.toFixed(2)}`}
        >
          <DataTable
            headings={[
              "Date",
              "Type",
              "Stage",
              "Task",
              "Description",
              "Source",
              "Amount",
            ]}
            rows={ledger.map((c) => ({
              id: c.id,
              cells: [
                dateValue(c.date),
                c.costType,
                c.stage?.name ?? "—",
                c.task?.code ?? "—",
                c.description,
                c.sourceType,
                c.amount.toFixed(2),
              ],
            }))}
          />
        </FormCard>
      )}
      <FormCard title="Expenses and approval status">
        <DataTable
          headings={["Code", "Date", "Description", "Amount", "Status"]}
          rows={expenses.map((e) => ({
            id: e.id,
            cells: [
              e.code,
              dateValue(e.date),
              e.description,
              e.amount.toFixed(2),
              e.status,
            ],
          }))}
        />
      </FormCard>
      {(ctx.isAdmin || ctx.permissions.has("expense.create")) && (
        <FormCard title="Create expense">
          <ActionForm
            action={expenseAction.bind(null, org, projectId)}
            submit="Submit expense for approval"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Expense date"
                name="date"
                type="date"
                defaultValue={dateValue(new Date())}
                required
              />
              <CostTypeField />
              <Field
                label="Expense amount"
                name="amount"
                inputMode="decimal"
                required
              />
              <Field label="Expense description" name="description" required />
              <SelectField label="Expense stage" name="stageId">
                <Options rows={stages} />
              </SelectField>
              <SelectField label="Expense task" name="taskId">
                <Options
                  rows={tasks.map((t) => ({
                    id: t.id,
                    name: `${t.code} · ${t.title}`,
                  }))}
                />
              </SelectField>
              <SelectField label="Expense party" name="partyId">
                <Options
                  rows={parties.map((p) => ({ id: p.id, name: p.displayName }))}
                />
              </SelectField>
            </div>
          </ActionForm>
        </FormCard>
      )}
    </>
  );
}
export default function Page(props: Parameters<typeof Costs>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Costs {...props} />
    </Suspense>
  );
}
