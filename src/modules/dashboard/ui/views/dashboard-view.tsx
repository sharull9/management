import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Progress } from "@/components/ui/progress";
import {
  canViewProjectCost,
  projectAccessWhere,
  projectCostAccessWhere,
  requireOrgContext,
} from "@/core/context";
import { db } from "@/core/db";
import { Prisma } from "@/generated/prisma/client";
import { listPendingForUser } from "@/modules/approvals/server/service";
import { budgetUsage } from "@/modules/project-cost/server/budget-usage";
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
  return (
    <>
      <PageHeading
        title={ctx.org.name}
        description="Project delivery and cost summary."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormCard title="Active projects">
          <p className="text-3xl font-semibold">{projects.length}</p>
        </FormCard>
        <FormCard title="Pending approvals for you">
          <Link
            className="text-3xl font-semibold underline"
            href={`/${org}/approvals`}
          >
            {pending.length}
          </Link>
        </FormCard>
        {showCost && (
          <FormCard title="Spent this month">
            {Array.from(monthTotals, ([currency, total]) => (
              <p key={currency} className="text-2xl font-semibold">
                {currency} {total.toFixed(2)}
              </p>
            ))}
          </FormCard>
        )}
      </div>
      <FormCard title="Active projects">
        <DataTable
          headings={["Project", "Budget", "Spent", "Budget usage"]}
          rows={projects.map((p) => {
            const projectCost = canViewProjectCost(ctx, p);
            const spent =
              costs.find((c) => c.projectId === p.id)?._sum.amount ??
              new Prisma.Decimal(0);
            const usage = budgetUsage(p.budgetAmount, spent);
            return {
              id: p.id,
              cells: [
                <Link
                  key="project"
                  className="underline"
                  href={`/${org}/projects/${p.id}`}
                >
                  {p.code} · {p.name}
                </Link>,
                projectCost
                  ? `${p.currency} ${p.budgetAmount.toFixed(2)}`
                  : "—",
                projectCost ? spent.toFixed(2) : "—",
                projectCost ? (
                  <div key="usage" className="min-w-32 space-y-2">
                    <span>{usage.percent}%</span>
                    <Progress value={Math.min(100, Number(usage.percent))} />
                  </div>
                ) : (
                  "—"
                ),
              ],
            };
          })}
        />
      </FormCard>
      <FormCard title="Overdue tasks">
        <DataTable
          headings={["Project", "Task", "Due"]}
          rows={overdue.map((t) => ({
            id: t.id,
            cells: [
              t.project.name,
              <Link
                key="task"
                className="underline"
                href={`/${org}/projects/${t.projectId}/tasks/${t.id}`}
              >
                {t.code} · {t.title}
              </Link>,
              t.dueDate?.toISOString().slice(0, 10),
            ],
          }))}
        />
      </FormCard>
    </>
  );
}
