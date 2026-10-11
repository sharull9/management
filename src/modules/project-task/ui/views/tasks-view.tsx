import { parseMultiParam } from "@/components/shared/filter-bar/multi-param";
import { dateValue } from "@/components/shared/form/date-value";
import { toOptions } from "@/components/shared/form/enum-options";
import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { Card, CardContent } from "@/components/ui/card";
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
  const statuses = parseMultiParam(filters.status).filter(
    (value): value is TaskStatus =>
      Object.values(TaskStatus).includes(value as TaskStatus),
  );
  const stageIds = parseMultiParam(filters.stageId);
  const [stages, tasks] = await Promise.all([
    db.stage.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: {
        projectId,
        ...(statuses.length ? { status: { in: statuses } } : {}),
        ...(stageIds.length ? { stageId: { in: stageIds } } : {}),
        ...(filters.search
          ? { title: { contains: filters.search, mode: "insensitive" } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const stageName = new Map(stages.map((stage) => [stage.id, stage.name]));
  return (
    <>
      <SectionHeader
        title="Tasks"
        description="Work items across all stages of this project."
        actions={
          (ctx.isAdmin || ctx.permissions.has("task.manage")) && (
            <CreateSheet label="New task">
              <TaskForm org={org} projectId={projectId} stages={stages} />
            </CreateSheet>
          )
        }
      />
      <Card>
        <CardContent>
          <TasksTable
            org={org}
            projectId={projectId}
            toolbar={
              <TaskFilters
                org={org}
                projectId={projectId}
                stages={toOptions(stages)}
              />
            }
            data={tasks.map((t) => ({
              id: t.id,
              task: `${t.code} · ${t.title}`,
              stage: (t.stageId && stageName.get(t.stageId)) || "Unallocated",
              priority: t.priority,
              status: t.status,
              due: dateValue(t.dueDate),
              progress: `${t.progressPercent}%`,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
