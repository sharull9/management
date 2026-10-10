import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { DataTable } from "@/components/shared/data-table";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { dateValue, Options } from "@/components/shared/form-options";
import { Badge } from "@/components/ui/badge";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { taskWorkAction } from "../../server/work-actions";
import { TaskForm } from "../components/task-form";
export async function TaskDetailView({
  org,
  projectId,
  taskId,
}: {
  org: string;
  projectId: string;
  taskId: string;
}) {
  const ctx = await requireProjectContext(org, projectId);
  const [task, stages, workers, history] = await Promise.all([
    db.task.findFirstOrThrow({
      where: { id: taskId, projectId },
      include: {
        assignments: { include: { worker: true } },
        submissions: {
          include: {
            submittedBy: true,
            worker: true,
            approvalRequest: {
              include: {
                steps: {
                  include: { actedBy: true },
                  orderBy: { sequence: "asc" },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        delays: {
          include: {
            approvalRequest: {
              include: {
                steps: {
                  include: { actedBy: true },
                  orderBy: { sequence: "asc" },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.stage.findMany({ where: { projectId }, orderBy: { sequence: "asc" } }),
    db.projectWorker.findMany({
      where: { projectId, worker: { active: true } },
      include: { worker: true },
    }),
    db.auditLog.findMany({
      where: {
        organizationId: ctx.org.id,
        entityType: "Task",
        entityId: taskId,
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const attachments = await db.attachment.findMany({
    where: {
      organizationId: ctx.org.id,
      entityType: "TaskSubmission",
      entityId: { in: task.submissions.map((s) => s.id) },
    },
  });
  const action = taskWorkAction.bind(null, org, projectId, taskId);
  const manage = ctx.isAdmin || ctx.permissions.has("task.manage");
  const open = !["COMPLETED", "CANCELLED"].includes(task.status);
  const options = [
    ...new Map(
      workers.map((w) => [w.workerId, { id: w.workerId, name: w.worker.name }]),
    ).values(),
  ];
  return (
    <>
      <Link
        className="text-sm underline"
        href={`/${org}/projects/${projectId}/tasks`}
      >
        All tasks
      </Link>
      <h2 className="text-xl font-semibold">
        {task.code} · {task.title}
      </h2>
      <Badge variant="secondary">{task.status}</Badge>
      <FormCard title="Details">
        <p className="mb-4 whitespace-pre-wrap text-sm">{task.description}</p>
        <DataTable
          headings={[
            "Priority",
            "Due",
            "Actual start",
            "Completed",
            "Progress",
            "Estimated hours",
          ]}
          rows={[
            {
              id: task.id,
              cells: [
                task.priority,
                dateValue(task.dueDate),
                dateValue(task.actualStart),
                dateValue(task.completedAt),
                `${task.progressPercent}%`,
                task.estimatedHours?.toString() ?? "—",
              ],
            },
          ]}
        />
      </FormCard>
      {manage && !["SUBMITTED", "COMPLETED"].includes(task.status) && (
        <FormCard title="Edit task">
          <TaskForm
            org={org}
            projectId={projectId}
            task={task}
            stages={stages}
          />
        </FormCard>
      )}
      {manage && ["TODO", "REWORK"].includes(task.status) && (
        <ActionForm action={action} submit="Start work">
          <input type="hidden" name="operation" value="START" />
        </ActionForm>
      )}
      <FormCard title="Assigned workers">
        <DataTable
          headings={["Worker", "Dates", "Action"]}
          rows={task.assignments.map((a) => ({
            id: a.id,
            cells: [
              a.worker.name,
              `${dateValue(a.startDate)} / ${dateValue(a.endDate)}`,
              manage && open ? (
                <ActionForm
                  key="remove"
                  action={action}
                  submit="Remove assignment"
                  destructive
                >
                  <input type="hidden" name="operation" value="UNASSIGN" />
                  <input type="hidden" name="workerId" value={a.workerId} />
                </ActionForm>
              ) : (
                "—"
              ),
            ],
          }))}
        />
        {manage && open && (
          <div className="mt-4">
            <ActionForm action={action} submit="Assign worker">
              <input type="hidden" name="operation" value="ASSIGN" />
              <SelectField label="Project worker" name="workerId" required>
                <Options rows={options} empty="Choose worker" />
              </SelectField>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assignment start" name="startDate" type="date" />
                <Field label="Assignment end" name="endDate" type="date" />
              </div>
            </ActionForm>
          </div>
        )}
      </FormCard>
      {(ctx.isAdmin || ctx.permissions.has("task.submit")) &&
        ["IN_PROGRESS", "REWORK"].includes(task.status) && (
          <FormCard title="Submit work">
            <ActionForm action={action} submit="Submit for approval">
              <input type="hidden" name="operation" value="SUBMIT" />
              <Field label="Work note" name="note" required />
              <Field
                label="Progress percent"
                name="progressPercent"
                type="number"
                min={0}
                max={100}
                defaultValue={task.progressPercent}
                required
              />
              <SelectField
                label="On behalf of worker"
                name="onBehalfOfWorkerId"
              >
                <Options
                  rows={task.assignments.map((a) => ({
                    id: a.workerId,
                    name: a.worker.name,
                  }))}
                  empty="Submitted by me"
                />
              </SelectField>
              <Field
                label="Work photos"
                name="attachments"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
              />
            </ActionForm>
          </FormCard>
        )}
      {(ctx.isAdmin || ctx.permissions.has("task.delay.request")) && open && (
        <FormCard title="Request delay">
          <ActionForm action={action} submit="Request delay approval">
            <input type="hidden" name="operation" value="DELAY" />
            <Field
              label="Proposed due date"
              name="proposedDueDate"
              type="date"
              required
            />
            <Field label="Delay reason" name="reason" required />
          </ActionForm>
        </FormCard>
      )}
      <FormCard title="Submissions and approval timeline">
        {task.submissions.map((s) => (
          <div key={s.id} className="mb-4 space-y-2 rounded-md border p-4">
            <p className="text-sm">
              {s.status} · {s.progressPercent}% · {s.submittedBy.name}
              {s.worker ? ` for ${s.worker.name}` : ""} ·{" "}
              {s.createdAt.toISOString()}
            </p>
            <p className="whitespace-pre-wrap text-sm">{s.note}</p>
            {attachments
              .filter((a) => a.entityId === s.id)
              .map((a) => (
                <a
                  key={a.id}
                  className="mr-3 text-sm underline"
                  href={`/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.filename}
                </a>
              ))}
            <ol className="space-y-2">
              {s.approvalRequest?.steps.map((step) => (
                <li key={step.id} className="text-sm">
                  {step.sequence}. {step.name} · {step.status} ·{" "}
                  {step.actedBy?.name} {step.comment}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {!task.submissions.length && (
          <p className="text-sm text-muted-foreground">No submissions.</p>
        )}
      </FormCard>
      <FormCard title="Delay history">
        {task.delays.map((d) => (
          <div key={d.id} className="mb-4 space-y-2 rounded-md border p-4">
            <p className="text-sm">
              {d.status} · {dateValue(d.currentDueDate)} →{" "}
              {dateValue(d.proposedDueDate)}
            </p>
            <p className="text-sm">{d.reason}</p>
            <ol>
              {d.approvalRequest?.steps.map((s) => (
                <li key={s.id} className="text-sm">
                  {s.name} · {s.status} · {s.actedBy?.name} {s.comment}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {!task.delays.length && (
          <p className="text-sm text-muted-foreground">No delay requests.</p>
        )}
      </FormCard>
      <FormCard title="Task history">
        <DataTable
          headings={["When", "Action", "Actor"]}
          rows={history.map((h) => ({
            id: h.id,
            cells: [h.createdAt.toISOString(), h.action, h.user?.name ?? "—"],
          }))}
        />
      </FormCard>
    </>
  );
}
