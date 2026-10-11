import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { dateValue } from "@/components/shared/form-options";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { Prisma } from "@/generated/prisma/client";
import { CostType } from "@/generated/prisma/enums";
import { readDate } from "@/modules/project/server/queries";
import { CostFilters } from "../components/cost-filters";
import { CostLedgerTable, ExpensesTable } from "../components/cost-tables";
import { ExpenseForm } from "../components/expense-form";
export async function CostsView({
  org,
  projectId,
  searchParams,
}: {
  org: string;
  projectId: string;
  searchParams: {
    costType?: string;
    stageId?: string;
    from?: string;
    to?: string;
  };
}) {
  const ctx = await requireProjectContext(org, projectId);
  const canCost = ctx.isAdmin || ctx.permissions.has("cost.view");
  if (!canCost) assertPermission(ctx, "expense.create");
  const filters = searchParams;
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
    db.task.findMany({
      where: { projectId },
      take: 50,
      orderBy: { title: "asc" },
    }),
    db.party.findMany({
      where: { tenantId: ctx.tenant.id },
      take: 50,
      orderBy: { displayName: "asc" },
    }),
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
      <CostFilters
        org={org}
        projectId={projectId}
        stages={toOptions(stages)}
        defaults={{
          costType: Object.values(CostType).includes(
            filters.costType as CostType,
          )
            ? (filters.costType as CostType)
            : null,
          stageId: filters.stageId ?? null,
          from: filters.from ?? "",
          to: filters.to ?? "",
        }}
      />
      {canCost && (
        <FormCard
          title={`Cost ledger · ${ctx.project.currency} ${total.toFixed(2)}`}
        >
          <CostLedgerTable
            data={ledger.map((c) => ({
              id: c.id,
              date: dateValue(c.date),
              type: c.costType,
              stage: c.stage?.name ?? "—",
              task: c.task?.code ?? "—",
              description: c.description,
              source: c.sourceType,
              amount: c.amount.toFixed(2),
            }))}
          />
        </FormCard>
      )}
      <FormCard title="Expenses and approval status">
        <ExpensesTable
          data={expenses.map((e) => ({
            id: e.id,
            code: e.code,
            date: dateValue(e.date),
            description: e.description,
            amount: e.amount.toFixed(2),
            status: e.status,
          }))}
        />
      </FormCard>
      {(ctx.isAdmin || ctx.permissions.has("expense.create")) && (
        <FormCard title="Create expense">
          <ExpenseForm
            org={org}
            projectId={projectId}
            date={dateValue(new Date())}
            stages={toOptions(stages)}
            tasks={tasks.map((t) => ({
              value: t.id,
              label: `${t.code} · ${t.title}`,
            }))}
            parties={parties.map((p) => ({
              value: p.id,
              label: p.displayName,
            }))}
          />
        </FormCard>
      )}
    </>
  );
}
