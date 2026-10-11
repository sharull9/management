import type { ReactNode } from "react";
import { FormCard } from "@/components/shared/form-card";
import { MaterialCostRecognitionBadge } from "@/components/shared/material-cost-recognition-badge";
import { Progress } from "@/components/ui/progress";
import type { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { budgetUsage } from "@/modules/project-cost/server/budget-usage";
import { projectSpent } from "@/modules/project-cost/server/queries";
import { projectUserOptions } from "../../server/queries";
import { OverviewTable } from "../components/overview-table";
import { ProjectForm } from "../components/project-form";
export async function ProjectOverviewView({
  org,
  projectId,
  ctx,
  costRecognitionForm,
}: {
  org: string;
  projectId: string;
  ctx: Awaited<ReturnType<typeof requireProjectContext>>;
  costRecognitionForm: ReactNode;
}) {
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
    projectUserOptions(
      ctx.org.id,
      ctx.project.managerUserId ? [ctx.project.managerUserId] : [],
    ),
    db.party.findMany({
      where: {
        tenantId: ctx.tenant.id,
        isCustomer: true,
        id: ctx.project.clientPartyId ?? "",
      },
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
            {costRecognitionForm}
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
              <OverviewTable
                labelTitle="Type"
                valueTitle="Amount"
                data={byType.map((row) => ({
                  id: row.costType,
                  label: row.costType,
                  value: row._sum.amount?.toFixed(2) ?? "0.00",
                }))}
              />
            </FormCard>
            <FormCard title="Cost by stage">
              <OverviewTable
                labelTitle="Stage"
                valueTitle="Amount"
                data={byStage.map((row) => ({
                  id: row.stageId ?? "none",
                  label:
                    stages.find((stage) => stage.id === row.stageId)?.name ??
                    "Unallocated",
                  value: row._sum.amount?.toFixed(2) ?? "0.00",
                }))}
              />
            </FormCard>
          </div>
        </>
      )}
      <FormCard title="Task progress">
        <OverviewTable
          labelTitle="Status"
          valueTitle="Tasks"
          data={counts.map((row) => ({
            id: row.status,
            label: row.status,
            value: row._count,
          }))}
        />
      </FormCard>
      <FormCard title="Overdue tasks">
        <OverviewTable
          labelTitle="Task"
          valueTitle="Due"
          data={overdue.map((row) => ({
            id: row.id,
            label: `${row.code} \u00b7 ${row.title}`,
            value: row.dueDate?.toISOString().slice(0, 10) ?? "",
            href: `/${org}/projects/${projectId}/tasks/${row.id}`,
          }))}
        />
      </FormCard>
      <FormCard title="Pending project approvals">
        <OverviewTable
          labelTitle="Document"
          valueTitle="Type"
          data={pending.map((row) => ({
            id: row.id,
            label:
              row.documentType === "EXPENSE" && !canCost
                ? "Expense approval"
                : row.title,
            value: row.documentType,
            href: `/${org}/approvals`,
          }))}
        />
      </FormCard>
      {(ctx.isAdmin ||
        ctx.permissions.has("project.edit") ||
        ctx.permissions.has("project.manage")) && (
        <FormCard title="Edit project">
          <ProjectForm
            org={org}
            project={{
              id: ctx.project.id,
              name: ctx.project.name,
              description: ctx.project.description ?? "",
              status: ctx.project.status,
              budgetAmount: ctx.project.budgetAmount.toFixed(2),
              currency: ctx.project.currency,
              clientPartyId: ctx.project.clientPartyId,
              managerUserId: ctx.project.managerUserId,
              startDate:
                ctx.project.startDate?.toISOString().slice(0, 10) ?? "",
              endDate: ctx.project.endDate?.toISOString().slice(0, 10) ?? "",
              customerName: "",
              customerLegalName: "",
              materialCostRecognition: ctx.project.materialCostRecognition,
              confirmCostRecognitionChange: false,
            }}
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
