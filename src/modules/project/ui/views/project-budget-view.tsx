import { FormCard } from "@/components/shared/form-card";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
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
    };
  });
  const stageOptions = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
  }));
  return (
    <>
      <h2 className="text-lg font-medium">Budget</h2>
      <FormCard
        title={`Total project budget \u00b7 ${ctx.project.currency} ${ctx.project.budgetAmount.toFixed(2)}`}
      >
        {manage && (
          <TotalBudgetForm
            org={org}
            projectId={projectId}
            budgetAmount={ctx.project.budgetAmount.toFixed(2)}
          />
        )}
      </FormCard>
      <FormCard title="Budget vs actual by type and stage">
        <BudgetSummaryTable data={groups} />
        <p className="mt-3 text-xs text-muted-foreground">
          Lines with the same type and stage are combined. Unallocated lines
          compare with costs without a stage. Labour attendance is unallocated.
          Actuals on individual lines are shared when lines have the same type
          and stage; use the combined table for totals.
        </p>
      </FormCard>
      <FormCard title="Budget lines">
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
          }))}
        />
      </FormCard>
      {manage && (
        <FormCard title="Add budget lines">
          <BudgetLinesForm
            org={org}
            projectId={projectId}
            stages={stageOptions}
          />
        </FormCard>
      )}
    </>
  );
}
