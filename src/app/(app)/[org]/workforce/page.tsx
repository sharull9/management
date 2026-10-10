import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import { dateValue, Options, WorkerForm } from "@/components/project-forms";
import { DataTable } from "@/components/project-table";
import { Button } from "@/components/ui/button";
import { assertPermission, requireOrgContext } from "@/server/context";
import { db } from "@/server/db";
import { designationAction } from "@/server/projects/actions";
import { rangesOverlap } from "@/server/projects/availability";
import { readDate } from "@/server/projects/queries";

async function Workforce({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    search?: string;
    workerId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { org } = await params;
  const ctx = await requireOrgContext(org);
  if (!(ctx.isAdmin || ctx.permissions.has("workforce.manage")))
    assertPermission(ctx, "workforce.view");
  const filters = await searchParams;
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
    }),
  ]);
  const allWorkers = await db.worker.findMany({
    where: { organizationId: ctx.org.id },
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
      <form className="grid items-end gap-4 sm:grid-cols-5">
        <Field
          label="Search workers"
          name="search"
          defaultValue={filters.search}
        />
        <SelectField
          label="Worker filter"
          name="workerId"
          defaultValue={filters.workerId ?? ""}
        >
          <Options rows={allWorkers} empty="All workers" />
        </SelectField>
        <Field
          label="Available from"
          name="from"
          type="date"
          defaultValue={dateValue(range.startDate)}
        />
        <Field
          label="Available to"
          name="to"
          type="date"
          defaultValue={dateValue(range.endDate)}
        />
        <Button type="submit">Check availability</Button>
      </form>
      {range.endDate < range.startDate && (
        <p role="alert" className="text-sm text-destructive">
          End date must be on or after start date.
        </p>
      )}
      <FormCard title="Workers">
        <DataTable
          headings={[
            "Code",
            "Name",
            "Designation",
            "Pay type",
            "Salary",
            "Active",
            "Actions",
          ]}
          rows={workers.map((w) => ({
            id: w.id,
            cells: [
              w.code,
              w.name,
              w.designation?.name ?? "—",
              w.payType,
              w.salaryAmount.toFixed(2),
              w.active ? "Yes" : "No",
              manage ? (
                <details key="edit">
                  <summary className="cursor-pointer">Edit worker</summary>
                  <div className="min-w-64 pt-4">
                    <WorkerForm
                      org={org}
                      worker={w}
                      designations={designations}
                    />
                  </div>
                </details>
              ) : (
                "—"
              ),
            ],
          }))}
        />
      </FormCard>
      <FormCard
        title={`Availability · ${dateValue(range.startDate)} to ${dateValue(range.endDate)}`}
      >
        <DataTable
          headings={["Worker", "Availability", "Current / upcoming projects"]}
          rows={workers.map((w) => {
            const overlaps = w.projects.filter((p) => rangesOverlap(p, range));
            return {
              id: w.id,
              cells: [
                w.name,
                !w.active ? "Inactive" : overlaps.length ? "Busy" : "Free",
                <ul key="assignments" className="space-y-2">
                  {w.projects
                    .filter((p) => !p.endDate || p.endDate >= range.startDate)
                    .map((p) => (
                      <li key={p.id}>
                        <Link
                          className="underline"
                          href={`/${org}/projects/${p.projectId}`}
                        >
                          {p.project.name}
                        </Link>{" "}
                        · {dateValue(p.startDate)} to{" "}
                        {dateValue(p.endDate) || "Open"}
                      </li>
                    ))}
                </ul>,
              ],
            };
          })}
        />
      </FormCard>
      {manage && (
        <>
          <FormCard title="Create worker">
            <WorkerForm org={org} designations={designations} />
          </FormCard>
          <FormCard title="Designations">
            <DataTable
              headings={["Designation", "Actions"]}
              rows={designations.map((d) => ({
                id: d.id,
                cells: [
                  d.name,
                  <div key="actions" className="space-y-4">
                    <ActionForm
                      action={designationAction.bind(null, org)}
                      submit="Save designation"
                    >
                      <input type="hidden" name="id" value={d.id} />
                      <Field
                        label="Designation name"
                        name="name"
                        defaultValue={d.name}
                        required
                      />
                    </ActionForm>
                    <ActionForm
                      action={designationAction.bind(null, org)}
                      submit="Delete designation"
                      destructive
                    >
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="operation" value="DELETE" />
                    </ActionForm>
                  </div>,
                ],
              }))}
            />
            <div className="mt-4">
              <ActionForm
                action={designationAction.bind(null, org)}
                submit="Create designation"
              >
                <Field label="Designation name" name="name" required />
              </ActionForm>
            </div>
          </FormCard>
        </>
      )}
    </>
  );
}
export default function Page(props: Parameters<typeof Workforce>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Workforce {...props} />
    </Suspense>
  );
}
