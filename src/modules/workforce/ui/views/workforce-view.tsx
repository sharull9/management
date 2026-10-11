import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { dateValue } from "@/components/shared/form-options";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { readDate } from "@/modules/project/server/queries";
import { rangesOverlap } from "../../server/availability";
import { DesignationForm } from "../components/designation-form";
import { WorkerForm } from "../components/worker-form";
import { WorkforceFilters } from "../components/workforce-filters";
import {
  AvailabilityTable,
  DesignationsTable,
  WorkersTable,
} from "../components/workforce-tables";
export async function WorkforceView({
  org,
  searchParams,
}: {
  org: string;
  searchParams: {
    search?: string;
    workerId?: string;
    from?: string;
    to?: string;
  };
}) {
  const ctx = await requireOrgContext(org);
  if (!(ctx.isAdmin || ctx.permissions.has("workforce.manage")))
    assertPermission(ctx, "workforce.view");
  const filters = searchParams;
  const [workers, designations] = await Promise.all([
    db.worker.findMany({
      where: {
        organizationId: ctx.org.id,
        ...(filters.search
          ? { name: { contains: filters.search, mode: "insensitive" } }
          : {}),
        ...(filters.workerId ? { id: filters.workerId } : {}),
      },
      include: {
        designation: true,
        projects: { include: { project: true }, orderBy: { startDate: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    db.designation.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const allWorkers = await db.worker.findMany({
    where: {
      organizationId: ctx.org.id,
      ...(filters.workerId ? { id: filters.workerId } : {}),
    },
    take: 50,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const range = {
    startDate: readDate(
      filters.from,
      new Date(new Date().toISOString().slice(0, 10)),
    ),
    endDate: filters.to
      ? readDate(filters.to, new Date(new Date().toISOString().slice(0, 10)))
      : readDate(filters.from, new Date(new Date().toISOString().slice(0, 10))),
  };
  const manage = ctx.isAdmin || ctx.permissions.has("workforce.manage");
  return (
    <>
      <PageHeading
        title="Workforce"
        description="Workers do not log in. Managers record their attendance and work."
      />
      <WorkforceFilters
        org={org}
        workers={toOptions(allWorkers)}
        defaults={{
          search: filters.search ?? "",
          workerId: filters.workerId ?? null,
          from: dateValue(range.startDate),
          to: dateValue(range.endDate),
        }}
      />
      {range.endDate < range.startDate && (
        <p role="alert" className="text-sm text-destructive">
          End date must be on or after start date.
        </p>
      )}
      <FormCard title="Workers">
        <WorkersTable
          org={org}
          manage={manage}
          designations={designations}
          data={workers.map((w) => ({
            id: w.id,
            code: w.code,
            name: w.name,
            designation: w.designation?.name ?? "—",
            payType: w.payType,
            salary: w.salaryAmount.toFixed(2),
            active: w.active ? "Yes" : "No",
            edit: {
              id: w.id,
              name: w.name,
              phone: w.phone ?? "",
              designationId: w.designationId,
              payType: w.payType,
              salaryAmount: w.salaryAmount.toFixed(2),
              costDaysPerMonth: w.costDaysPerMonth.toString(),
              standardHoursPerDay: w.standardHoursPerDay.toString(),
              overtimeMultiplier: w.overtimeMultiplier.toString(),
              joinDate: dateValue(w.joinDate),
              active: w.active,
            },
          }))}
        />
      </FormCard>
      <FormCard
        title={`Availability · ${dateValue(range.startDate)} to ${dateValue(range.endDate)}`}
      >
        <AvailabilityTable
          org={org}
          data={workers.map((w) => ({
            id: w.id,
            worker: w.name,
            availability: !w.active
              ? "Inactive"
              : w.projects.some((p) => rangesOverlap(p, range))
                ? "Busy"
                : "Free",
            projects: w.projects
              .filter((p) => !p.endDate || p.endDate >= range.startDate)
              .map((p) => ({
                id: p.id,
                projectId: p.projectId,
                name: p.project.name,
                start: dateValue(p.startDate),
                end: dateValue(p.endDate),
              })),
          }))}
        />
      </FormCard>
      {manage && (
        <>
          <FormCard title="Create worker">
            <WorkerForm org={org} designations={designations} />
          </FormCard>
          <FormCard title="Designations">
            <DesignationsTable
              org={org}
              data={designations.map((d) => ({ id: d.id, name: d.name }))}
            />
            <div className="mt-4">
              <DesignationForm org={org} />
            </div>
          </FormCard>
        </>
      )}
    </>
  );
}
