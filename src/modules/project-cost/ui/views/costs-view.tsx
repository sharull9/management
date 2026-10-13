import { parseMultiParam } from "@/components/shared/filter-bar/multi-param";
import { dateValue } from "@/components/shared/form/date-value";
import { toOptions } from "@/components/shared/form/enum-options";
import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { StatTiles } from "@/components/shared/stat-tiles";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { formatMoney } from "@/core/format";
import { Prisma } from "@/generated/prisma/client";
import { CostType } from "@/generated/prisma/enums";
import { listEnabledCurrencies } from "@/modules/currency/server/queries";
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
  const costTypes = parseMultiParam(filters.costType).filter(
    (value): value is CostType =>
      Object.values(CostType).includes(value as CostType),
  );
  const stageIds = parseMultiParam(filters.stageId);
  const [ledger, stages, tasks, parties, expenses, enabled] = await Promise.all(
    [
      canCost
        ? db.costEntry.findMany({
            where: {
              projectId,
              ...(costTypes.length ? { costType: { in: costTypes } } : {}),
              ...(stageIds.length ? { stageId: { in: stageIds } } : {}),
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
      listEnabledCurrencies(ctx.tenant.id, ctx.org.baseCurrency),
    ],
  );
  const projectCurrency = ctx.project.currency;
  const baseCurrency = ctx.org.baseCurrency;
  const currencyOptions = [
    ...new Map(
      [
        ...enabled.map((c) => [c.code, `${c.code} | ${c.name}`] as const),
        [projectCurrency, projectCurrency] as const,
        [baseCurrency, baseCurrency] as const,
      ].map(([value, label]) => [value, { value, label }]),
    ).values(),
  ];
  const total = ledger.reduce(
    (sum, c) => sum.add(c.amount),
    new Prisma.Decimal(0),
  );
  const posted = expenses.length
    ? await db.costEntry.findMany({
        where: {
          organizationId: ctx.org.id,
          sourceType: "EXPENSE",
          sourceId: { in: expenses.map((e) => e.id) },
        },
        select: { sourceId: true, amount: true },
      })
    : [];
  const postedAmount = new Map(posted.map((p) => [p.sourceId, p.amount]));
  const expensesTable = (
    <Card>
      <CardContent>
        <ExpensesTable
          data={expenses.map((e) => ({
            id: e.id,
            code: e.code,
            date: dateValue(e.date),
            description: e.description,
            original: formatMoney(e.amount, e.currency),
            project: (() => {
              const value =
                postedAmount.get(e.id) ??
                (e.currency === projectCurrency ? e.amount : null);
              return value ? formatMoney(value, projectCurrency) : "—";
            })(),
            base: formatMoney(e.baseAmount, baseCurrency),
            status: e.status,
          }))}
        />
      </CardContent>
    </Card>
  );
  return (
    <>
      <SectionHeader
        title="Costs"
        description={`Recognised project costs and expense claims. Costs are shown in ${projectCurrency}.`}
        actions={
          (ctx.isAdmin || ctx.permissions.has("expense.create")) && (
            <CreateSheet
              label="New expense"
              description="Expenses are recorded as costs once approved."
            >
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
                projectCurrency={projectCurrency}
                baseCurrency={baseCurrency}
                currencies={currencyOptions}
              />
            </CreateSheet>
          )
        }
      />
      {canCost ? (
        <UrlTabs
          tabs={[
            {
              value: "ledger",
              label: "Cost ledger",
              count: ledger.length,
              content: (
                <>
                  <StatTiles
                    stats={[
                      {
                        label: "Total in view",
                        value: formatMoney(total, projectCurrency),
                        detail: `${ledger.length} entries`,
                      },
                    ]}
                    className="lg:max-w-xs"
                  />
                  <Card>
                    <CardContent>
                      <CostLedgerTable
                        currency={projectCurrency}
                        toolbar={
                          <CostFilters
                            org={org}
                            projectId={projectId}
                            stages={toOptions(stages)}
                          />
                        }
                        data={ledger.map((c) => ({
                          id: c.id,
                          date: dateValue(c.date),
                          type: c.costType,
                          stage: c.stage?.name ?? "—",
                          task: c.task?.code ?? "—",
                          description: c.description,
                          source: c.sourceType,
                          original: formatMoney(
                            c.originalAmount,
                            c.originalCurrency,
                          ),
                          amount: formatMoney(c.amount, projectCurrency),
                        }))}
                      />
                    </CardContent>
                  </Card>
                </>
              ),
            },
            {
              value: "expenses",
              label: "Expenses",
              count: expenses.length,
              content: expensesTable,
            },
          ]}
        />
      ) : (
        expensesTable
      )}
    </>
  );
}
