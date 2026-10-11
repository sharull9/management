import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { dateValue } from "@/components/shared/form-options";
import { Badge } from "@/components/ui/badge";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { taskFormValues } from "../../util";
import {
  AssignmentsTable,
  TaskHistoryTable,
  TaskSummaryTable,
} from "../components/task-detail-tables";
import { TaskForm } from "../components/task-form";
import { TaskSubmissionForm } from "../components/task-submission-form";
import {
  TaskAssignmentForm,
  TaskDelayForm,
  TaskStartForm,
} from "../components/task-work-forms";
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
    db.stage.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true },
    }),
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
        <TaskSummaryTable
          data={[
            {
              id: task.id,
              priority: task.priority,
              due: dateValue(task.dueDate),
              actualStart: dateValue(task.actualStart),
              completed: dateValue(task.completedAt),
              progress: `${task.progressPercent}%`,
              estimatedHours: task.estimatedHours?.toString() ?? "—",
            },
          ]}
        />
      </FormCard>
      {manage && !["SUBMITTED", "COMPLETED"].includes(task.status) && (
        <FormCard title="Edit task">
          <TaskForm
            org={org}
            projectId={projectId}
            task={taskFormValues(task)}
            stages={stages}
          />
        </FormCard>
      )}
      {manage && ["TODO", "REWORK"].includes(task.status) && (
        <TaskStartForm org={org} projectId={projectId} taskId={taskId} />
      )}
      <FormCard title="Assigned workers">
        <AssignmentsTable
          org={org}
          projectId={projectId}
          taskId={taskId}
          canRemove={manage && open}
          data={task.assignments.map((a) => ({
            id: a.id,
            workerId: a.workerId,
            worker: a.worker.name,
            dates: `${dateValue(a.startDate)} / ${dateValue(a.endDate)}`,
          }))}
        />
        {manage && open && (
          <div className="mt-4">
            <TaskAssignmentForm
              org={org}
              projectId={projectId}
              taskId={taskId}
              workers={toOptions(options)}
            />
          </div>
        )}
      </FormCard>
      {(ctx.isAdmin || ctx.permissions.has("task.submit")) &&
        ["IN_PROGRESS", "REWORK"].includes(task.status) && (
          <FormCard title="Submit work">
            <TaskSubmissionForm
              org={org}
              projectId={projectId}
              taskId={taskId}
              progressPercent={task.progressPercent}
              workers={task.assignments.map((a) => ({
                value: a.workerId,
                label: a.worker.name,
              }))}
            />
          </FormCard>
        )}
      {(ctx.isAdmin || ctx.permissions.has("task.delay.request")) && open && (
        <FormCard title="Request delay">
          <TaskDelayForm org={org} projectId={projectId} taskId={taskId} />
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
        {!task.submissions.length && <EmptyState title="No submissions." />}
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
        {!task.delays.length && <EmptyState title="No delay requests." />}
      </FormCard>
      <FormCard title="Task history">
        <TaskHistoryTable
          data={history.map((h) => ({
            id: h.id,
            when: h.createdAt.toISOString(),
            action: h.action,
            actor: h.user?.name ?? "—",
          }))}
        />
      </FormCard>
    </>
  );
}
