import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { dateValue } from "@/components/shared/form-options";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { TaskStatus } from "@/generated/prisma/enums";
import { TaskFilters } from "../components/task-filters";
import { TaskForm } from "../components/task-form";
import { TasksTable } from "../components/tasks-table";
export async function TasksView({
  org,
  projectId,
  searchParams,
}: {
  org: string;
  projectId: string;
  searchParams: { status?: string; stageId?: string; search?: string };
}) {
  const ctx = await requireProjectContext(org, projectId);
  const filters = searchParams;
  const [stages, tasks] = await Promise.all([
    db.stage.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: {
        projectId,
        ...(Object.values(TaskStatus).includes(filters.status as TaskStatus)
          ? { status: filters.status as TaskStatus }
          : {}),
        ...(filters.stageId ? { stageId: filters.stageId } : {}),
        ...(filters.search
          ? { title: { contains: filters.search, mode: "insensitive" } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return (
    <>
      <h2 className="text-lg font-medium">Tasks</h2>
      <TaskFilters
        org={org}
        projectId={projectId}
        stages={toOptions(stages)}
        defaults={{
          search: filters.search ?? "",
          status: Object.values(TaskStatus).includes(
            filters.status as TaskStatus,
          )
            ? (filters.status as TaskStatus)
            : null,
          stageId: filters.stageId ?? null,
        }}
      />
      {[...stages, { id: "", name: "Unallocated" }].map((stage) => (
        <FormCard key={stage.id} title={stage.name}>
          <TasksTable
            org={org}
            projectId={projectId}
            data={tasks
              .filter((t) => (t.stageId ?? "") === stage.id)
              .map((t) => ({
                id: t.id,
                task: `${t.code} · ${t.title}`,
                priority: t.priority,
                status: t.status,
                due: dateValue(t.dueDate),
                progress: `${t.progressPercent}%`,
              }))}
          />
        </FormCard>
      ))}
      {(ctx.isAdmin || ctx.permissions.has("task.manage")) && (
        <FormCard title="Create task">
          <TaskForm org={org} projectId={projectId} stages={stages} />
        </FormCard>
      )}
    </>
  );
}
