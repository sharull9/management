import { parseMultiParam } from "@/components/shared/filter-bar/multi-param";
import { dateValue } from "@/components/shared/form/date-value";
import { toOptions } from "@/components/shared/form/enum-options";
import { CreateSheet, SideSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { UrlTabs } from "@/components/shared/url-tabs";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { readDate } from "@/modules/project/server/queries";
import { rangesOverlap } from "../../server/availability";
import { DesignationForm } from "../components/designation-form";
import { WorkerForm } from "../components/worker-form";
import {
  AvailabilityFilters,
  WorkerSearchFilter,
} from "../components/workforce-filters";
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
  const workerIds = parseMultiParam(filters.workerId);
  const [workers, designations] = await Promise.all([
    db.worker.findMany({
      where: {
        organizationId: ctx.org.id,
        ...(filters.search
          ? { name: { contains: filters.search, mode: "insensitive" } }
          : {}),
        ...(workerIds.length ? { id: { in: workerIds } } : {}),
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
      ...(workerIds.length ? { id: { in: workerIds } } : {}),
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
        description="Workers do not log in. Managers record their attendance and work. Pay is costed in the currency of the project a worker is attending."
        actions={
          manage && (
            <CreateSheet label="New worker">
              <WorkerForm org={org} designations={designations} />
            </CreateSheet>
          )
        }
      />
      <UrlTabs
        tabs={[
          {
            value: "workers",
            label: "Workers",
            count: workers.length,
            content: (
              <Card>
                <CardContent>
                  <WorkersTable
                    org={org}
                    manage={manage}
                    designations={designations}
                    toolbar={<WorkerSearchFilter />}
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
                </CardContent>
              </Card>
            ),
          },
          {
            value: "availability",
            label: "Availability",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {dateValue(range.startDate)} to {dateValue(range.endDate)}
                  </CardTitle>
                  {range.endDate < range.startDate && (
                    <p role="alert" className="text-sm text-destructive">
                      End date must be on or after start date.
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <AvailabilityTable
                    org={org}
                    toolbar={
                      <AvailabilityFilters
                        org={org}
                        workers={toOptions(allWorkers)}
                      />
                    }
                    data={workers.map((w) => ({
                      id: w.id,
                      worker: w.name,
                      availability: !w.active
                        ? "Inactive"
                        : w.projects.some((p) => rangesOverlap(p, range))
                          ? "Busy"
                          : "Free",
                      projects: w.projects
                        .filter(
                          (p) => !p.endDate || p.endDate >= range.startDate,
                        )
                        .map((p) => ({
                          id: p.id,
                          projectId: p.projectId,
                          name: p.project.name,
                          start: dateValue(p.startDate),
                          end: dateValue(p.endDate),
                        })),
                    }))}
                  />
                </CardContent>
              </Card>
            ),
          },
          ...(manage
            ? [
                {
                  value: "designations",
                  label: "Designations",
                  count: designations.length,
                  content: (
                    <Card>
                      <CardHeader>
                        <CardTitle>Designations</CardTitle>
                        <CardAction>
                          <SideSheet
                            title="New designation"
                            trigger="New designation"
                            triggerIcon="plus"
                            triggerVariant="outline"
                            triggerSize="sm"
                            width="md"
                          >
                            <DesignationForm org={org} />
                          </SideSheet>
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <DesignationsTable
                          org={org}
                          data={designations.map((d) => ({
                            id: d.id,
                            name: d.name,
                          }))}
                        />
                      </CardContent>
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
