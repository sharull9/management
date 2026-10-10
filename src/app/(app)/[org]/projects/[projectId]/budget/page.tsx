import { Suspense } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { CostTypeField } from "@/components/shared/cost-type-field";
import { DataTable } from "@/components/shared/data-table";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { Options } from "@/components/shared/form-options";
import Loading from "@/components/shared/page-loading";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { Prisma } from "@/generated/prisma/client";
import { budgetAction } from "@/server/projects/actions";

async function Budget({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const { org, projectId } = await params;
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
  const action = budgetAction.bind(null, org, projectId);
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
      cells: [
        first.costType,
        first.stage?.name ?? "Unallocated",
        planned.toFixed(2),
        spent.toFixed(2),
        planned.sub(spent).toFixed(2),
      ],
    };
  });
  return (
    <>
      <h2 className="text-lg font-medium">Budget</h2>
      <FormCard
        title={`Total project budget · ${ctx.project.currency} ${ctx.project.budgetAmount.toFixed(2)}`}
      >
        {manage && (
          <ActionForm action={action} submit="Save total budget">
            <input type="hidden" name="operation" value="TOTAL" />
            <Field
              label="Total budget"
              name="budgetAmount"
              defaultValue={ctx.project.budgetAmount.toFixed(2)}
              inputMode="decimal"
              required
            />
          </ActionForm>
        )}
      </FormCard>
      <FormCard title="Budget vs actual by type and stage">
        <DataTable
          headings={["Type", "Stage", "Budget", "Actual", "Remaining"]}
          rows={groups}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Lines with the same type and stage are combined. Unallocated lines
          compare with costs without a stage. Labour attendance is unallocated.
          Actuals on individual lines are shared when lines have the same type
          and stage; use the combined table for totals.
        </p>
      </FormCard>
      <FormCard title="Budget lines">
        <DataTable
          headings={[
            "Type",
            "Stage",
            "Budget",
            "Actual for type/stage",
            "Remaining vs line",
            "Note",
            "Actions",
          ]}
          rows={lines.map((l) => ({
            id: l.id,
            cells: [
              l.costType,
              l.stage?.name ?? "Unallocated",
              l.amount.toFixed(2),
              lineActual(l).toFixed(2),
              l.amount.sub(lineActual(l)).toFixed(2),
              l.note,
              manage ? (
                <div key="actions" className="space-y-4">
                  <details>
                    <summary className="cursor-pointer">Edit line</summary>
                    <ActionForm action={action}>
                      <input type="hidden" name="id" value={l.id} />
                      <CostTypeField defaultValue={l.costType} />
                      <SelectField
                        label="Budget stage"
                        name="stageId"
                        defaultValue={l.stageId ?? ""}
                      >
                        <Options rows={stages} />
                      </SelectField>
                      <Field
                        label="Line amount"
                        name="amount"
                        defaultValue={l.amount.toFixed(2)}
                        required
                      />
                      <Field
                        label="Line note"
                        name="note"
                        defaultValue={l.note ?? ""}
                      />
                    </ActionForm>
                  </details>
                  <ActionForm
                    action={action}
                    submit="Delete budget line"
                    destructive
                  >
                    <input type="hidden" name="operation" value="DELETE" />
                    <input type="hidden" name="id" value={l.id} />
                  </ActionForm>
                </div>
              ) : (
                "—"
              ),
            ],
          }))}
        />
      </FormCard>
      {manage && (
        <FormCard title="Add budget line">
          <ActionForm action={action} submit="Add budget line">
            <CostTypeField />
            <SelectField label="Budget stage" name="stageId">
              <Options rows={stages} />
            </SelectField>
            <Field
              label="Line amount"
              name="amount"
              inputMode="decimal"
              required
            />
            <Field label="Line note" name="note" />
          </ActionForm>
        </FormCard>
      )}
    </>
  );
}
export default function Page(props: Parameters<typeof Budget>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Budget {...props} />
    </Suspense>
  );
}
