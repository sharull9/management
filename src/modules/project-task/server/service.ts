import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { nextDocumentNumber } from "@/core/numbering";
import {
  audit,
  dateOrder,
  nullableDate,
  stageInProject,
} from "@/modules/project";
import { taskInput } from "../schema";

export async function saveTask(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "task.manage");
    const taskId = optional(data, "id");
    const input = taskInput.parse({
      ...Object.fromEntries(data),
      stageId: optional(data, "stageId"),
      estimatedHours: optional(data, "estimatedHours"),
    });
    const plannedStart = nullableDate(data, "plannedStart"),
      dueDate = nullableDate(data, "dueDate");
    dateOrder(plannedStart, dueDate);
    const saved = await db.$transaction(async (tx) => {
      await stageInProject(tx, projectId, input.stageId);
      if (taskId) {
        await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
        const task = await tx.task.findFirstOrThrow({
          where: { id: taskId, projectId },
        });
        if (["SUBMITTED", "COMPLETED"].includes(task.status))
          throw new Error("Submitted/completed tasks cannot be edited.");
        if (
          task.dueDate?.getTime() !== dueDate?.getTime() &&
          (await tx.taskDelayRequest.count({
            where: { taskId, status: "PENDING" },
          }))
        )
          throw new Error(
            "Decide the pending delay before changing the due date.",
          );
      }
      const current = taskId
        ? await tx.task.findUniqueOrThrow({ where: { id: taskId } })
        : null;
      const fields = {
        ...input,
        plannedStart,
        dueDate,
        actualStart:
          input.status === "IN_PROGRESS"
            ? (current?.actualStart ?? new Date())
            : current?.actualStart,
      };
      const row = taskId
        ? await tx.task.update({ where: { id: taskId }, data: fields })
        : await tx.task.create({
            data: {
              ...fields,
              projectId,
              code: await nextDocumentNumber(ctx.org.id, "TSK", tx),
            },
          });
      await audit(ctx, tx, "Task", row.id, taskId ? "UPDATE" : "CREATE");
      return row;
    });
    return taskId
      ? undefined
      : `/${org}/projects/${projectId}/tasks/${saved.id}`;
  });
}
