"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
export async function findTaskStages(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "project.view");
  const search = z.string().max(150).parse(query);
  return (
    await db.stage.findMany({
      where: { projectId, name: { contains: search, mode: "insensitive" } },
      orderBy: { sequence: "asc" },
      take: 50,
      select: { id: true, name: true },
    })
  ).map((r) => ({ value: r.id, label: r.name }));
}
export async function findTaskWorkers(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "task.manage");
  const search = z.string().max(150).parse(query);
  return (
    await db.worker.findMany({
      where: {
        organizationId: ctx.org.id,
        active: true,
        projects: { some: { projectId } },
        name: { contains: search, mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true },
    })
  ).map((r) => ({ value: r.id, label: r.name }));
}
export async function findSubmissionWorkers(
  org: string,
  projectId: string,
  taskId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "task.submit");
  const search = z.string().max(150).parse(query);
  await db.task.findFirstOrThrow({ where: { id: taskId, projectId } });
  return (
    await db.taskAssignment.findMany({
      where: {
        taskId,
        worker: {
          active: true,
          name: { contains: search, mode: "insensitive" },
        },
      },
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { worker: { name: "asc" } },
      take: 50,
    })
  ).map((r) => ({ value: r.worker.id, label: r.worker.name }));
}
