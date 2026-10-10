import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { dateValue, EnumOptions } from "@/components/shared/form-options";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canViewProjectCost,
  projectAccessWhere,
  projectCostAccessWhere,
  requireOrgContext,
} from "@/core/context";
import { db } from "@/core/db";
import { ProjectStatus } from "@/generated/prisma/enums";
import { budgetUsage } from "@/modules/project-cost";
import { projectUsers } from "../../server/queries";
import { ProjectForm } from "../components/project-form";
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
    projectUsers(ctx.org.id),
    db.party.findMany({
      where: { tenantId: ctx.tenant.id, isCustomer: true },
      select: { id: true, displayName: true },
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
      <form className="grid items-end gap-4 sm:grid-cols-3">
        <Field label="Search" name="search" defaultValue={filters.search} />
        <SelectField
          label="Status"
          name="status"
          defaultValue={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          <EnumOptions values={ProjectStatus} />
        </SelectField>
        <Button type="submit">Filter projects</Button>
      </form>
      <FormCard title="Projects">
        <DataTable
          headings={[
            "Code",
            "Name",
            "Client",
            "Manager",
            "Dates",
            "Status",
            "Budget",
            "Spent",
            "Used",
          ]}
          rows={projects.map((p) => {
            const projectCost = canViewProjectCost(ctx, p);
            const spent =
              costs
                .find((c) => c.projectId === p.id)
                ?._sum.amount?.toFixed(2) ?? "0.00";
            return {
              id: p.id,
              cells: [
                p.code,
                <Link
                  key="name"
                  className="underline"
                  href={`/${org}/projects/${p.id}`}
                >
                  {p.name}
                </Link>,
                p.clientParty?.displayName ?? "—",
                p.manager?.name ?? "—",
                `${dateValue(p.startDate)} / ${dateValue(p.endDate)}`,
                <Badge key="status" variant="secondary">
                  {p.status}
                </Badge>,
                projectCost
                  ? `${p.currency} ${p.budgetAmount.toFixed(2)}`
                  : "—",
                projectCost ? spent : "—",
                projectCost
                  ? `${budgetUsage(p.budgetAmount, spent).percent}%`
                  : "—",
              ],
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
