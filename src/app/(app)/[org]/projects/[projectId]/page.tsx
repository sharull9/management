import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { FormCard } from "@/components/form-card";
import {
  MaterialCostRecognitionBadge,
  ProjectCostRecognitionForm,
  ProjectForm,
} from "@/components/project-forms";
import { DataTable } from "@/components/project-table";
import { Progress } from "@/components/ui/progress";
import { requireProjectContext } from "@/server/context";
import { db } from "@/server/db";
import { budgetUsage } from "@/server/projects/costing";
import { projectSpent, projectUsers } from "@/server/projects/queries";

async function Overview({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const { org, projectId } = await params;
  const ctx = await requireProjectContext(org, projectId);
  const canCost = ctx.isAdmin || ctx.permissions.has("cost.view");
  const [
    spent,
    byType,
    byStage,
    stages,
    counts,
    overdue,
    pending,
    users,
    customers,
  ] = await Promise.all([
    canCost ? projectSpent(projectId) : Promise.resolve("0"),
    canCost
      ? db.costEntry.groupBy({
          by: ["costType"],
          where: { projectId },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    canCost
      ? db.costEntry.groupBy({
          by: ["stageId"],
          where: { projectId },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    db.stage.findMany({ where: { projectId } }),
    db.task.groupBy({ by: ["status"], where: { projectId }, _count: true }),
    db.task.findMany({
      where: {
        projectId,
        dueDate: { lt: new Date(new Date().toISOString().slice(0, 10)) },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { dueDate: "asc" },
    }),
    db.approvalRequest.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    projectUsers(ctx.org.id),
    db.party.findMany({
      where: { tenantId: ctx.tenant.id, isCustomer: true },
      select: { id: true, displayName: true },
    }),
  ]);
  const usage = budgetUsage(ctx.project.budgetAmount, spent);
  return (
    <>
      <MaterialCostRecognitionBadge
        mode={ctx.project.materialCostRecognition}
      />
      {ctx.permissions.has("project.settings.manage") &&
        !ctx.isAdmin &&
        !ctx.permissions.has("project.edit") &&
        !ctx.permissions.has("project.manage") && (
          <FormCard title="Material cost setting">
            <ProjectCostRecognitionForm org={org} project={ctx.project} />
          </FormCard>
        )}
      {canCost && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Budget", ctx.project.budgetAmount.toFixed(2)],
              ["Spent", spent],
              ["Remaining", usage.remaining.toFixed(2)],
            ].map(([title, amount]) => (
              <FormCard key={title} title={title}>
                <p className="text-2xl font-semibold">
                  {ctx.project.currency} {amount}
                </p>
              </FormCard>
            ))}
          </div>
          <FormCard title={`Budget used: ${usage.percent}%`}>
            <Progress value={Math.min(100, Number(usage.percent))} />
          </FormCard>
          <div className="grid gap-4 md:grid-cols-2">
            <FormCard title="Cost by type">
              <DataTable
                headings={["Type", "Amount"]}
                rows={byType.map((c) => ({
                  id: c.costType,
                  cells: [c.costType, c._sum.amount?.toFixed(2)],
                }))}
              />
            </FormCard>
            <FormCard title="Cost by stage">
              <DataTable
                headings={["Stage", "Amount"]}
                rows={byStage.map((c) => ({
                  id: c.stageId ?? "none",
                  cells: [
                    stages.find((s) => s.id === c.stageId)?.name ??
                      "Unallocated",
                    c._sum.amount?.toFixed(2),
                  ],
                }))}
              />
            </FormCard>
          </div>
        </>
      )}
      <FormCard title="Task progress">
        <DataTable
          headings={["Status", "Tasks"]}
          rows={counts.map((c) => ({
            id: c.status,
            cells: [c.status, c._count],
          }))}
        />
      </FormCard>
      <FormCard title="Overdue tasks">
        <DataTable
          headings={["Task", "Due"]}
          rows={overdue.map((t) => ({
            id: t.id,
            cells: [
              <Link
                key="task"
                className="underline"
                href={`/${org}/projects/${projectId}/tasks/${t.id}`}
              >
                {t.code} · {t.title}
              </Link>,
              t.dueDate?.toISOString().slice(0, 10),
            ],
          }))}
        />
      </FormCard>
      <FormCard title="Pending project approvals">
        <DataTable
          headings={["Document", "Type"]}
          rows={pending.map((r) => ({
            id: r.id,
            cells: [
              <Link
                key="approval"
                className="underline"
                href={`/${org}/approvals`}
              >
                {r.documentType === "EXPENSE" && !canCost
                  ? "Expense approval"
                  : r.title}
              </Link>,
              r.documentType,
            ],
          }))}
        />
      </FormCard>
      {(ctx.isAdmin ||
        ctx.permissions.has("project.edit") ||
        ctx.permissions.has("project.manage")) && (
        <FormCard title="Edit project">
          <ProjectForm
            org={org}
            project={ctx.project}
            currency={ctx.org.baseCurrency}
            users={users}
            customers={customers.map((c) => ({
              id: c.id,
              name: c.displayName,
            }))}
          />
        </FormCard>
      )}
    </>
  );
}
export default function Page(props: Parameters<typeof Overview>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Overview {...props} />
    </Suspense>
  );
}
