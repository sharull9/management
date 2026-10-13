import { CreateSheet, SideSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { StatTiles } from "@/components/shared/stat-tiles";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { formatMoney } from "@/core/format";
import { Prisma } from "@/generated/prisma/client";
import { TotalBudgetForm } from "../components/budget-forms";
import { BudgetLinesForm } from "../components/budget-lines-form";
import {
  BudgetLinesTable,
  BudgetSummaryTable,
} from "../components/budget-tables";
export async function ProjectBudgetView({
  org,
  projectId,
}: {
  org: string;
  projectId: string;
}) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "cost.view");
  const [lines, stages, actual] = await Promise.all([
    db.projectBudgetLine.findMany({
      where: { projectId },
      include: { stage: true },
      orderBy: { costType: "asc" },
    }),
    db.stage.findMany({ where: { projectId }, orderBy: { sequence: "asc" } }),
    db.costEntry.groupBy({
      by: ["costType", "stageId"],
      where: { projectId },
      _sum: { amount: true },
    }),
  ]);
  const manage = ctx.isAdmin || ctx.permissions.has("project.edit");
  const lineActual = (line: (typeof lines)[number]) =>
    actual
      .filter((a) => a.costType === line.costType && a.stageId === line.stageId)
      .reduce((sum, a) => sum.add(a._sum.amount ?? 0), new Prisma.Decimal(0));
  const groups = [
    ...new Set(lines.map((l) => `${l.costType}:${l.stageId ?? ""}`)),
  ].map((key) => {
    const group = lines.filter(
      (l) => `${l.costType}:${l.stageId ?? ""}` === key,
    );
    const first = group[0];
    const planned = group.reduce(
      (sum, l) => sum.add(l.amount),
      new Prisma.Decimal(0),
    );
    const spent = actual
      .filter(
        (a) => a.costType === first.costType && a.stageId === first.stageId,
      )
      .reduce((sum, a) => sum.add(a._sum.amount ?? 0), new Prisma.Decimal(0));
    return {
      id: key,
      costType: first.costType,
      stage: first.stage?.name ?? "Unallocated",
      amount: planned.toFixed(2),
      actual: spent.toFixed(2),
      remaining: planned.sub(spent).toFixed(2),
      currency: ctx.project.currency,
    };
  });
  const stageOptions = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
  }));
  const plannedTotal = lines.reduce(
    (sum, line) => sum.add(line.amount),
    new Prisma.Decimal(0),
  );
  const actualTotal = actual.reduce(
    (sum, a) => sum.add(a._sum.amount ?? 0),
    new Prisma.Decimal(0),
  );
  const currency = ctx.project.currency;
  return (
    <>
      <SectionHeader
        title="Budget"
        description={`Plan spend by cost type and stage, and compare with actuals. All amounts are in ${currency}.`}
        actions={
          manage && (
            <>
              <SideSheet
                title="Total project budget"
                trigger="Edit total"
                triggerVariant="outline"
                width="md"
              >
                <TotalBudgetForm
                  org={org}
                  projectId={projectId}
                  budgetAmount={ctx.project.budgetAmount.toFixed(2)}
                />
              </SideSheet>
              <CreateSheet label="Add budget lines" width="xl">
                <BudgetLinesForm
                  org={org}
                  projectId={projectId}
                  stages={stageOptions}
                />
              </CreateSheet>
            </>
          )
        }
      />
      <StatTiles
        stats={[
          {
            label: `Total budget (${currency})`,
            value: formatMoney(ctx.project.budgetAmount, currency),
          },
          {
            label: "Planned in lines",
            value: formatMoney(plannedTotal, currency),
            detail: `${lines.length} lines`,
          },
          { label: "Actual", value: formatMoney(actualTotal, currency) },
          {
            label: "Remaining vs total",
            value: formatMoney(
              ctx.project.budgetAmount.sub(actualTotal),
              currency,
            ),
          },
        ]}
      />
      <UrlTabs
        tabs={[
          {
            value: "summary",
            label: "Budget vs actual",
            count: groups.length,
            content: (
              <Card>
                <CardContent className="space-y-3">
                  <BudgetSummaryTable data={groups} />
                  <p className="text-xs text-muted-foreground">
                    Lines with the same type and stage are combined. Unallocated
                    lines compare with costs without a stage. Labour attendance
                    is unallocated. Actuals on individual lines are shared when
                    lines have the same type and stage; use this table for
                    totals.
                  </p>
                </CardContent>
              </Card>
            ),
          },
          {
            value: "lines",
            label: "Budget lines",
            count: lines.length,
            content: (
              <Card>
                <CardContent>
                  <BudgetLinesTable
                    org={org}
                    projectId={projectId}
                    manage={manage}
                    stages={stageOptions}
                    data={lines.map((line) => ({
                      id: line.id,
                      costType: line.costType,
                      stageId: line.stageId,
                      stage: line.stage?.name ?? "Unallocated",
                      amount: line.amount.toFixed(2),
                      actual: lineActual(line).toFixed(2),
                      remaining: line.amount.sub(lineActual(line)).toFixed(2),
                      note: line.note ?? "",
                      currency,
                    }))}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
