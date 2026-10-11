import Link from "next/link";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { dateValue } from "@/components/shared/form/date-value";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { CreateSheet, SideSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { taskFormValues } from "../../util";
import {
  AssignmentsTable,
  TaskHistoryTable,
} from "../components/task-detail-tables";
import { TaskForm } from "../components/task-form";
import { TaskSubmissionForm } from "../components/task-submission-form";
import {
  TaskAssignmentForm,
  TaskDelayForm,
  TaskStartForm,
} from "../components/task-work-forms";

const stepsInclude = {
  steps: {
    include: { actedBy: true },
    orderBy: { sequence: "asc" },
  },
} as const;

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
            approvalRequest: { include: stepsInclude },
          },
          orderBy: { createdAt: "desc" },
        },
        delays: {
          include: { approvalRequest: { include: stepsInclude } },
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
  const canEdit = manage && !["SUBMITTED", "COMPLETED"].includes(task.status);
  const canStart = manage && ["TODO", "REWORK"].includes(task.status);
  const canSubmit =
    (ctx.isAdmin || ctx.permissions.has("task.submit")) &&
    ["IN_PROGRESS", "REWORK"].includes(task.status);
  const canDelay =
    (ctx.isAdmin || ctx.permissions.has("task.delay.request")) && open;
  const options = [
    ...new Map(
      workers.map((w) => [w.workerId, { id: w.workerId, name: w.worker.name }]),
    ).values(),
  ];
  const stageName = stages.find((s) => s.id === task.stageId)?.name ?? null;
  const assignees = task.assignments.map((a) => a.worker.name).join(", ");
  const priority = enumOptions({ [task.priority]: task.priority })[0].label;
  return (
    <>
      <Button asChild variant="link" size="sm" className="w-fit px-0">
        <Link href={`/${org}/projects/${projectId}/tasks`}>All tasks</Link>
      </Button>
      <PageHeading
        eyebrow={task.code}
        title={task.title}
        description={task.description?.trim() || "No description."}
        actions={
          <>
            <StatusBadge status={task.status} />
            {canStart && (
              <TaskStartForm org={org} projectId={projectId} taskId={taskId} />
            )}
            {canEdit && (
              <SideSheet
                title="Edit task"
                description={`${task.code} · ${task.title}`}
                trigger="Edit task"
                triggerVariant="outline"
              >
                <TaskForm
                  org={org}
                  projectId={projectId}
                  task={taskFormValues(task)}
                  stages={stages}
                />
              </SideSheet>
            )}
          </>
        }
      />
      <section className="space-y-3">
        <SectionHeader title="Overview" />
        <DetailList
          className="max-w-2xl"
          items={[
            { label: "Stage", value: stageName },
            { label: "Assignees", value: assignees || null },
            { label: "Priority", value: priority },
            { label: "Progress", value: `${task.progressPercent}%` },
            { label: "Planned start", value: dateValue(task.plannedStart) },
            { label: "Due", value: dateValue(task.dueDate) },
            { label: "Actual start", value: dateValue(task.actualStart) },
            { label: "Completed", value: dateValue(task.completedAt) },
            {
              label: "Estimated hours",
              value: task.estimatedHours?.toString() ?? null,
            },
          ]}
        />
      </section>
      <UrlTabs
        tabs={[
          {
            value: "assignments",
            label: "Assignments",
            count: task.assignments.length,
            content: (
              <>
                <SectionHeader
                  title="Assigned workers"
                  actions={
                    manage &&
                    open && (
                      <CreateSheet label="Assign workers">
                        <TaskAssignmentForm
                          org={org}
                          projectId={projectId}
                          taskId={taskId}
                          workers={toOptions(options)}
                        />
                      </CreateSheet>
                    )
                  }
                />
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
              </>
            ),
          },
          {
            value: "submissions",
            label: "Submissions",
            count: task.submissions.length,
            content: (
              <>
                <SectionHeader
                  title="Submissions and approval timeline"
                  actions={
                    canSubmit && (
                      <CreateSheet label="Submit work">
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
                      </CreateSheet>
                    )
                  }
                />
                {task.submissions.map((s) => (
                  <div key={s.id} className="space-y-2 rounded-md border p-4">
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
                  <EmptyState title="No submissions." />
                )}
              </>
            ),
          },
          {
            value: "delays",
            label: "Delays",
            count: task.delays.length,
            content: (
              <>
                <SectionHeader
                  title="Delay history"
                  actions={
                    canDelay && (
                      <CreateSheet label="Request delay">
                        <TaskDelayForm
                          org={org}
                          projectId={projectId}
                          taskId={taskId}
                        />
                      </CreateSheet>
                    )
                  }
                />
                {task.delays.map((d) => (
                  <div key={d.id} className="space-y-2 rounded-md border p-4">
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
                  <EmptyState title="No delay requests." />
                )}
              </>
            ),
          },
          {
            value: "history",
            label: "History",
            count: history.length,
            content: (
              <>
                <SectionHeader title="Task history" />
                <TaskHistoryTable
                  data={history.map((h) => ({
                    id: h.id,
                    when: h.createdAt.toISOString(),
                    action: h.action,
                    actor: h.user?.name ?? "—",
                  }))}
                />
              </>
            ),
          },
        ]}
      />
    </>
  );
}
