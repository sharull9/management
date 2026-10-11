import { FormCard } from "@/components/shared/form-card";
import { dateValue } from "@/components/shared/form-options";
import { PageHeading } from "@/components/shared/page-heading";
import {
  canViewProjectCost,
  projectAccessWhere,
  projectCostAccessWhere,
  requireOrgContext,
} from "@/core/context";
import { db } from "@/core/db";
import { ProjectStatus } from "@/generated/prisma/enums";
import { budgetUsage } from "@/modules/project-cost/server/budget-usage";
import { projectUserOptions } from "../../server/queries";
import { ProjectFilters } from "../components/project-filters";
import { ProjectForm } from "../components/project-form";
import { ProjectsTable } from "../components/projects-table";
export async function ProjectsView({
  org,
  searchParams,
}: {
  org: string;
  searchParams: { status?: string; search?: string };
}) {
  const ctx = await requireOrgContext(org);
  const filters = searchParams;
  const [projects, users, customers, costs] = await Promise.all([
    db.project.findMany({
      where: {
        organizationId: ctx.org.id,
        ...projectAccessWhere(ctx),
        ...(Object.values(ProjectStatus).includes(
          filters.status as ProjectStatus,
        )
          ? { status: filters.status as ProjectStatus }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { code: { contains: filters.search, mode: "insensitive" } },
              ],
              AND: [projectAccessWhere(ctx)],
            }
          : {}),
      },
      include: {
        clientParty: true,
        manager: true,
        members: { where: { userId: ctx.user.id }, include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    projectUserOptions(ctx.org.id),
    db.party.findMany({
      where: { tenantId: ctx.tenant.id, isCustomer: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
      take: 50,
    }),
    db.costEntry.groupBy({
      by: ["projectId"],
      where: {
        organizationId: ctx.org.id,
        project: projectCostAccessWhere(ctx),
      },
      _sum: { amount: true },
    }),
  ]);
  return (
    <>
      <PageHeading
        title="Projects"
        description="Track delivery, workforce and project costs."
      />
      <ProjectFilters
        org={org}
        search={filters.search}
        status={filters.status}
      />
      <FormCard title="Projects">
        <ProjectsTable
          org={org}
          data={projects.map((project) => {
            const projectCost = canViewProjectCost(ctx, project);
            const spent =
              costs
                .find((cost) => cost.projectId === project.id)
                ?._sum.amount?.toFixed(2) ?? "0.00";
            return {
              id: project.id,
              code: project.code,
              name: project.name,
              client: project.clientParty?.displayName ?? "\u2014",
              manager: project.manager?.name ?? "\u2014",
              dates: `${dateValue(project.startDate)} / ${dateValue(project.endDate)}`,
              status: project.status,
              budget: projectCost
                ? `${project.currency} ${project.budgetAmount.toFixed(2)}`
                : "\u2014",
              spent: projectCost ? spent : "\u2014",
              used: projectCost
                ? `${budgetUsage(project.budgetAmount, spent).percent}%`
                : "\u2014",
            };
          })}
        />
      </FormCard>
      {(ctx.isAdmin || ctx.permissions.has("project.create")) && (
        <FormCard title="Create project">
          <ProjectForm
            org={org}
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
