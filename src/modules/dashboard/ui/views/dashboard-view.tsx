import { FolderKanban, ListChecks, TriangleAlert, Wallet } from "lucide-react";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { type StatTile, StatTiles } from "@/components/shared/stat-tiles";
import {
  canViewProjectCost,
  projectAccessWhere,
  projectCostAccessWhere,
  requireOrgContext,
} from "@/core/context";
import { db } from "@/core/db";
import { formatMoney } from "@/core/format";
import { Prisma } from "@/generated/prisma/client";
import { listPendingForUser } from "@/modules/approvals/server/service";
import { budgetUsage } from "@/modules/project-cost/server/budget-usage";
import {
  DashboardProjectsTable,
  OverdueTasksTable,
} from "../components/dashboard-tables";
export async function DashboardView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  const access = projectAccessWhere(ctx);
  const costAccess = projectCostAccessWhere(ctx);
  const today = new Date();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const [projects, costs, month, pending, overdue] = await Promise.all([
    db.project.findMany({
      where: { organizationId: ctx.org.id, ...access, status: "ACTIVE" },
      include: {
        members: { where: { userId: ctx.user.id }, include: { role: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.costEntry.groupBy({
      by: ["projectId"],
      where: { organizationId: ctx.org.id, project: costAccess },
      _sum: { amount: true },
    }),
    db.costEntry.findMany({
      where: {
        organizationId: ctx.org.id,
        project: costAccess,
        date: { gte: monthStart, lte: today },
      },
      select: { amount: true, project: { select: { currency: true } } },
    }),
    listPendingForUser(org),
    db.task.findMany({
      where: {
        project: { organizationId: ctx.org.id, ...access },
        dueDate: { lt: new Date(today.toISOString().slice(0, 10)) },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { project: true },
      orderBy: { dueDate: "asc" },
      take: 100,
    }),
  ]);
  const showCost =
    ctx.isAdmin ||
    ctx.permissions.has("cost.view") ||
    projects.some((p) => canViewProjectCost(ctx, p)) ||
    month.length > 0;
  const monthTotals = new Map<string, Prisma.Decimal>();
  for (const entry of month)
    monthTotals.set(
      entry.project.currency,
      (monthTotals.get(entry.project.currency) ?? new Prisma.Decimal(0)).add(
        entry.amount,
      ),
    );
  if (!monthTotals.size)
    monthTotals.set(ctx.org.baseCurrency, new Prisma.Decimal(0));
  const stats: StatTile[] = [
    {
      label: "Active projects",
      value: projects.length,
      icon: FolderKanban,
      href: `/${org}/projects`,
    },
    {
      label: "Pending approvals",
      value: pending.length,
      detail: pending.length ? "Waiting on you" : "You're all caught up",
      icon: ListChecks,
      href: `/${org}/approvals`,
    },
    {
      label: "Overdue tasks",
      value: overdue.length,
      detail: overdue.length ? "Past their due date" : "Nothing overdue",
      icon: TriangleAlert,
    },
  ];
  if (showCost)
    stats.push({
      label: "Spent this month",
      value: Array.from(monthTotals, ([currency, total]) =>
        formatMoney(total, currency),
      ).join(" · "),
      detail: today.toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      icon: Wallet,
    });
  return (
    <>
      <PageHeading
        eyebrow="Dashboard"
        title={ctx.org.name}
        description="Project delivery and cost summary."
      />
      <StatTiles stats={stats} />
      <FormCard title="Active projects">
        <DashboardProjectsTable
          org={org}
          data={projects.map((p) => {
            const projectCost = canViewProjectCost(ctx, p);
            const spent =
              costs.find((c) => c.projectId === p.id)?._sum.amount ??
              new Prisma.Decimal(0);
            const usage = budgetUsage(p.budgetAmount, spent);
            return {
              id: p.id,
              project: `${p.code} · ${p.name}`,
              budget: projectCost
                ? formatMoney(p.budgetAmount, p.currency)
                : "—",
              spent: projectCost ? formatMoney(spent, p.currency) : "—",
              usage: projectCost ? String(usage.percent) : null,
            };
          })}
        />
      </FormCard>
      <FormCard title="Overdue tasks">
        <OverdueTasksTable
          org={org}
          data={overdue.map((t) => ({
            id: t.id,
            projectId: t.projectId,
            project: t.project.name,
            task: `${t.code} · ${t.title}`,
            due: t.dueDate?.toISOString().slice(0, 10) ?? "",
          }))}
        />
      </FormCard>
    </>
  );
}
