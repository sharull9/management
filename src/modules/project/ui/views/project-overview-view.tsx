import type { ReactNode } from "react";
import { FormCard } from "@/components/shared/form-card";
import { MaterialCostRecognitionBadge } from "@/components/shared/material-cost-recognition-badge";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { StatTiles } from "@/components/shared/stat-tiles";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { formatMoney } from "@/core/format";
import { cn } from "@/lib/utils";
import { budgetUsage } from "@/modules/project-cost/server/budget-usage";
import {
  projectSpent,
  projectSpentBase,
} from "@/modules/project-cost/server/queries";
import { projectUserOptions } from "../../server/queries";
import { OverviewList } from "../components/overview-list";
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
    spentBase,
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
    canCost && ctx.project.currency !== ctx.org.baseCurrency
      ? projectSpentBase(projectId)
      : Promise.resolve(null),
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
  const percentUsed = Number(usage.percent);
  const currency = ctx.project.currency;
  const base = `/${org}/projects/${projectId}`;
  const canEdit =
    ctx.isAdmin ||
    ctx.permissions.has("project.edit") ||
    ctx.permissions.has("project.manage");
  const amountOf = (row: { _sum: { amount: unknown } }) =>
    Number(row._sum.amount ?? 0);
  const typeMax = Math.max(0, ...byType.map(amountOf));
  const stageMax = Math.max(0, ...byStage.map(amountOf));
  const share = (value: number, max: number) =>
    max > 0 ? (value / max) * 100 : 0;
  const taskTotal = counts.reduce((sum, row) => sum + row._count, 0);
  const openTasks = counts
    .filter((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED")
    .reduce((sum, row) => sum + row._count, 0);
  const dates = [ctx.project.startDate, ctx.project.endDate]
    .map((date) => date?.toISOString().slice(0, 10))
    .filter(Boolean)
    .join(" → ");
  return (
    <>
      <SectionHeader
        title="Overview"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {customers[0] && <span>{customers[0].displayName}</span>}
            {dates && <span className="tabular-nums">{dates}</span>}
            <MaterialCostRecognitionBadge
              mode={ctx.project.materialCostRecognition}
            />
          </span>
        }
        actions={
          canEdit && (
            <SideSheet
              title="Edit project"
              description={`${ctx.project.code} · ${ctx.project.name}`}
              trigger="Edit project"
              triggerVariant="outline"
              width="xl"
            >
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
                  endDate:
                    ctx.project.endDate?.toISOString().slice(0, 10) ?? "",
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
            </SideSheet>
          )
        }
      />
      {ctx.permissions.has("project.settings.manage") && !canEdit && (
        <FormCard title="Material cost setting">{costRecognitionForm}</FormCard>
      )}
      <StatTiles
        stats={[
          ...(canCost
            ? [
                {
                  label: "Budget",
                  value: formatMoney(ctx.project.budgetAmount, currency),
                  href: `${base}/budget`,
                },
                {
                  label: "Spent",
                  value: formatMoney(spent, currency),
                  detail: spentBase
                    ? `${usage.percent}% of budget · ${formatMoney(spentBase, ctx.org.baseCurrency)} in base currency`
                    : `${usage.percent}% of budget`,
                  href: `${base}/costs`,
                },
                {
                  label: "Remaining",
                  value: formatMoney(usage.remaining, currency),
                },
              ]
            : []),
          {
            label: "Open tasks",
            value: openTasks,
            detail: `${taskTotal} total`,
            href: `${base}/tasks`,
          },
          {
            label: "Overdue",
            value: overdue.length,
            detail: `${pending.length} pending approvals`,
          },
        ]}
      />
      {canCost && (
        <Card>
          <CardHeader>
            <CardTitle>Budget used</CardTitle>
            <CardAction className="text-sm text-muted-foreground tabular-nums">
              {usage.percent}%
            </CardAction>
          </CardHeader>
          <CardContent>
            <Progress
              value={Math.min(100, percentUsed)}
              className={cn(percentUsed > 100 && "*:bg-destructive")}
            />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {canCost && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Cost by type</CardTitle>
              </CardHeader>
              <CardContent>
                <OverviewList
                  empty="No costs recorded yet."
                  rows={byType.map((row) => ({
                    id: row.costType,
                    label: <StatusBadge status={row.costType} tone="neutral" />,
                    value: formatMoney(amountOf(row), currency),
                    share: share(amountOf(row), typeMax),
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cost by stage</CardTitle>
              </CardHeader>
              <CardContent>
                <OverviewList
                  empty="No costs recorded yet."
                  rows={byStage.map((row) => ({
                    id: row.stageId ?? "none",
                    label:
                      stages.find((stage) => stage.id === row.stageId)?.name ??
                      "Unallocated",
                    value: formatMoney(amountOf(row), currency),
                    share: share(amountOf(row), stageMax),
                  }))}
                />
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Task progress</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewList
              empty="No tasks yet."
              rows={counts.map((row) => ({
                id: row.status,
                label: <StatusBadge status={row.status} />,
                value: row._count,
                share: share(row._count, taskTotal),
                href: `${base}/tasks?status=${row.status}`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewList
              empty="Nothing overdue."
              rows={overdue.map((row) => ({
                id: row.id,
                label: (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.code}
                    </span>{" "}
                    {row.title}
                  </>
                ),
                value: row.dueDate?.toISOString().slice(0, 10) ?? "",
                href: `${base}/tasks/${row.id}`,
              }))}
            />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewList
              empty="No approvals waiting."
              rows={pending.map((row) => ({
                id: row.id,
                label:
                  row.documentType === "EXPENSE" && !canCost
                    ? "Expense approval"
                    : row.title,
                value: <StatusBadge status={row.documentType} tone="neutral" />,
                href: `/${org}/approvals`,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
