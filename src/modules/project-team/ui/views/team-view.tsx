import { ActionForm } from "@/components/shared/action-form";
import { DataTable } from "@/components/shared/data-table";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { dateValue, Options } from "@/components/shared/form-options";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { projectUsers } from "@/modules/project";
import { rangesOverlap } from "@/modules/workforce";
import { teamAction } from "../../server/actions";
export async function TeamView({
  org,
  projectId,
}: {
  org: string;
  projectId: string;
}) {
  const ctx = await requireProjectContext(org, projectId);
  const [members, assignments, workers, users, roles] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId },
      include: { user: true, role: true },
    }),
    db.projectWorker.findMany({
      where: { projectId },
      include: {
        worker: { include: { projects: { include: { project: true } } } },
      },
      orderBy: { startDate: "asc" },
    }),
    db.worker.findMany({
      where: { organizationId: ctx.org.id, active: true },
      select: { id: true, name: true },
    }),
    projectUsers(ctx.org.id),
    db.role.findMany({ where: { tenantId: ctx.tenant.id } }),
  ]);
  const manage = ctx.isAdmin || ctx.permissions.has("project.edit");
  const action = teamAction.bind(null, org, projectId);
  return (
    <>
      <h2 className="text-lg font-medium">Project team</h2>
      <FormCard title="Members">
        <DataTable
          headings={["Member", "Role", "Manager", "Action"]}
          rows={members.map((m) => ({
            id: m.id,
            cells: [
              m.user.name,
              m.role?.name ?? "—",
              m.isManager ? "Yes" : "No",
              manage ? (
                <ActionForm
                  key="remove"
                  action={action}
                  submit="Remove member"
                  destructive
                >
                  <input type="hidden" name="operation" value="REMOVE_MEMBER" />
                  <input type="hidden" name="userId" value={m.userId} />
                </ActionForm>
              ) : (
                "—"
              ),
            ],
          }))}
        />
        {manage && (
          <div className="mt-4">
            <ActionForm action={action} submit="Save member">
              <input type="hidden" name="operation" value="MEMBER" />
              <SelectField label="Organization member" name="userId" required>
                <Options rows={users} empty="Choose member" />
              </SelectField>
              <SelectField label="Project role" name="roleId">
                <Options rows={roles} />
              </SelectField>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="isManager" />
                Project manager
              </label>
            </ActionForm>
          </div>
        )}
      </FormCard>
      <FormCard title="Worker assignments">
        <DataTable
          headings={[
            "Worker",
            "Start / end",
            "Day rate",
            "OT hourly rate",
            "Availability",
            "Action",
          ]}
          rows={assignments.map((a) => {
            const overlaps = a.worker.projects.filter(
              (p) => p.id !== a.id && rangesOverlap(a, p),
            );
            return {
              id: a.id,
              cells: [
                a.worker.name,
                `${dateValue(a.startDate)} / ${dateValue(a.endDate) || "Open"}`,
                a.dayRateOverride?.toString() ?? "Worker pay terms",
                a.otHourlyRateOverride?.toString() ?? "Worker pay terms",
                overlaps.length
                  ? `${overlaps.length} overlapping assignment(s)`
                  : "Available",
                manage ? (
                  <div key="actions" className="space-y-4">
                    <details>
                      <summary className="cursor-pointer">
                        Edit assignment
                      </summary>
                      <ActionForm action={action}>
                        <input type="hidden" name="operation" value="WORKER" />
                        <input type="hidden" name="id" value={a.id} />
                        <input
                          type="hidden"
                          name="workerId"
                          value={a.workerId}
                        />
                        <Field
                          label="Start date"
                          name="startDate"
                          type="date"
                          defaultValue={dateValue(a.startDate)}
                          required
                        />
                        <Field
                          label="End date"
                          name="endDate"
                          type="date"
                          defaultValue={dateValue(a.endDate)}
                        />
                        <Field
                          label="Day rate override"
                          name="dayRateOverride"
                          defaultValue={a.dayRateOverride?.toString() ?? ""}
                        />
                        <Field
                          label="OT hourly rate override"
                          name="otHourlyRateOverride"
                          defaultValue={
                            a.otHourlyRateOverride?.toString() ?? ""
                          }
                        />
                        <Field
                          label="Notes"
                          name="notes"
                          defaultValue={a.notes ?? ""}
                        />
                        <label className="flex gap-2 text-sm">
                          <input type="checkbox" name="confirmOverlap" />
                          Confirm overlapping assignments
                        </label>
                      </ActionForm>
                    </details>
                    <ActionForm
                      action={action}
                      submit="Remove worker"
                      destructive
                    >
                      <input
                        type="hidden"
                        name="operation"
                        value="REMOVE_WORKER"
                      />
                      <input type="hidden" name="workerId" value={a.workerId} />
                      <input type="hidden" name="id" value={a.id} />
                    </ActionForm>
                  </div>
                ) : (
                  "—"
                ),
              ],
            };
          })}
        />
      </FormCard>
      {manage && (
        <FormCard title="Assign worker">
          <ActionForm action={action} submit="Assign worker">
            <input type="hidden" name="operation" value="WORKER" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Worker" name="workerId" required>
                <Options rows={workers} empty="Choose worker" />
              </SelectField>
              <Field label="Start date" name="startDate" type="date" required />
              <Field label="End date" name="endDate" type="date" />
              <Field
                label="Day rate override"
                name="dayRateOverride"
                inputMode="decimal"
              />
              <Field
                label="OT hourly rate override"
                name="otHourlyRateOverride"
                inputMode="decimal"
              />
              <Field label="Notes" name="notes" />
            </div>
            <p className="text-sm text-muted-foreground">
              Overlapping project dates produce a warning. Review availability
              in Workforce before confirming.
            </p>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="confirmOverlap" />I confirm
              overlapping project assignments
            </label>
          </ActionForm>
        </FormCard>
      )}
    </>
  );
}
