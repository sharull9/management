import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import {
  dateValue,
  EnumOptions,
  Options,
} from "@/components/shared/form-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { TaskStatus } from "@/generated/prisma/enums";
import { TaskForm } from "../components/task-form";
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
    db.stage.findMany({ where: { projectId }, orderBy: { sequence: "asc" } }),
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
      <form className="grid items-end gap-4 sm:grid-cols-4">
        <Field
          label="Search tasks"
          name="search"
          defaultValue={filters.search}
        />
        <SelectField
          label="Task status"
          name="status"
          defaultValue={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          <EnumOptions values={TaskStatus} />
        </SelectField>
        <SelectField
          label="Stage filter"
          name="stageId"
          defaultValue={filters.stageId ?? ""}
        >
          <Options rows={stages} empty="All stages" />
        </SelectField>
        <Button type="submit">Filter tasks</Button>
      </form>
      {[...stages, { id: "", name: "Unallocated" }].map((s) => (
        <FormCard key={s.id} title={s.name}>
          <DataTable
            headings={["Task", "Priority", "Status", "Due", "Progress"]}
            rows={tasks
              .filter((t) => (t.stageId ?? "") === s.id)
              .map((t) => ({
                id: t.id,
                cells: [
                  <Link
                    key="task"
                    className="underline"
                    href={`/${org}/projects/${projectId}/tasks/${t.id}`}
                  >
                    {t.code} · {t.title}
                  </Link>,
                  t.priority,
                  <Badge key="status" variant="secondary">
                    {t.status}
                  </Badge>,
                  dateValue(t.dueDate),
                  `${t.progressPercent}%`,
                ],
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
