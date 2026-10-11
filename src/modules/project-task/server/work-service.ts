import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { storage } from "@/core/storage";
import {
  audit,
  dateOrder,
  nullableDate,
} from "@/modules/project/server/action-helpers";
import {
  date,
  id,
  taskSubmissionInput,
  taskWorkOperation,
  text,
} from "../schema";

export async function taskWork(
  org: string,
  projectId: string,
  taskId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    const operation = taskWorkOperation.parse(data.get("operation"));
    assertPermission(
      ctx,
      operation === "SUBMIT"
        ? "task.submit"
        : operation === "DELAY"
          ? "task.delay.request"
          : "task.manage",
    );
    const files = data
      .getAll("attachments")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (
      files.length > 10 ||
      files.some(
        (f) =>
          f.size > 20 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    )
      throw new Error(
        "Upload up to ten JPEG, PNG or WebP photos, at most 20 MB each.",
      );
    const uploaded: string[] = [];
    try {
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
          const task = await tx.task.findFirstOrThrow({
            where: { id: taskId, projectId },
          });
          if (["COMPLETED", "CANCELLED"].includes(task.status))
            throw new Error("This task is closed.");
          if (operation === "START") {
            if (!["TODO", "REWORK"].includes(task.status))
              throw new Error("Task is already started or submitted.");
            await tx.task.update({
              where: { id: task.id },
              data: {
                status: "IN_PROGRESS",
                actualStart: task.actualStart ?? new Date(),
              },
            });
          } else if (operation === "ASSIGN" || operation === "UNASSIGN") {
            const workerId = id.parse(data.get("workerId"));
            if (operation === "ASSIGN") {
              if (
                !(await tx.projectWorker.findFirst({
                  where: { projectId, workerId, worker: { active: true } },
                }))
              )
                throw new Error("Assign an active worker from this project.");
              const startDate = nullableDate(data, "startDate"),
                endDate = nullableDate(data, "endDate");
              dateOrder(startDate, endDate);
              const row = await tx.taskAssignment.upsert({
                where: { taskId_workerId: { taskId, workerId } },
                create: {
                  taskId,
                  workerId,
                  assignedById: ctx.user.id,
                  startDate,
                  endDate,
                },
                update: { startDate, endDate },
              });
              await audit(ctx, tx, "TaskAssignment", row.id, "UPSERT");
            } else {
              const row = await tx.taskAssignment.findUniqueOrThrow({
                where: { taskId_workerId: { taskId, workerId } },
              });
              await tx.taskAssignment.delete({ where: { id: row.id } });
              await audit(ctx, tx, "TaskAssignment", row.id, "DELETE");
            }
          } else if (operation === "SUBMIT") {
            if (!["IN_PROGRESS", "REWORK"].includes(task.status))
              throw new Error("Start the task before submitting work.");
            const input = taskSubmissionInput.parse({
              ...Object.fromEntries(data),
              onBehalfOfWorkerId: optional(data, "onBehalfOfWorkerId"),
            });
            if (
              input.onBehalfOfWorkerId &&
              !(await tx.taskAssignment.findFirst({
                where: {
                  taskId,
                  workerId: input.onBehalfOfWorkerId,
                  worker: { active: true },
                },
              }))
            )
              throw new Error(
                "Worker must be active and assigned to this task.",
              );
            const row = await tx.taskSubmission.create({
              data: { ...input, taskId, submittedById: ctx.user.id },
            });
            for (const file of files) {
              const storageKey = await storage.put(
                new Uint8Array(await file.arrayBuffer()),
              );
              uploaded.push(storageKey);
              const attachment = await tx.attachment.create({
                data: {
                  organizationId: ctx.org.id,
                  uploadedById: ctx.user.id,
                  entityType: "TaskSubmission",
                  entityId: row.id,
                  filename: file.name,
                  mimeType: file.type,
                  sizeBytes: file.size,
                  storageKey,
                },
              });
              await audit(ctx, tx, "Attachment", attachment.id, "CREATE");
            }
            const { submitForApproval } = await import(
              "@/modules/approvals/server/service"
            );
            const request = await submitForApproval(
              {
                orgSlug: org,
                documentType: "TASK_SUBMISSION",
                documentId: row.id,
                title: `${task.code}: ${task.title} — work submission`,
                projectId,
                stageId: task.stageId,
              },
              tx,
              ctx,
            );
            await tx.taskSubmission.update({
              where: { id: row.id },
              data: { approvalRequestId: request.id },
            });
            await tx.task.update({
              where: { id: taskId },
              data: {
                status: "SUBMITTED",
                progressPercent: input.progressPercent,
              },
            });
            await audit(ctx, tx, "TaskSubmission", row.id, "CREATE");
          } else {
            const reason = text.min(1).parse(data.get("reason"));
            const proposedDueDate = date.parse(data.get("proposedDueDate"));
            if (task.dueDate && proposedDueDate <= task.dueDate)
              throw new Error(
                "Proposed date must be later than the current due date.",
              );
            if (
              await tx.taskDelayRequest.count({
                where: { taskId, status: "PENDING" },
              })
            )
              throw new Error("A delay request is already pending.");
            const row = await tx.taskDelayRequest.create({
              data: {
                taskId,
                requestedById: ctx.user.id,
                currentDueDate: task.dueDate,
                proposedDueDate,
                reason,
              },
            });
            const { submitForApproval } = await import(
              "@/modules/approvals/server/service"
            );
            const request = await submitForApproval(
              {
                orgSlug: org,
                documentType: "TASK_DELAY",
                documentId: row.id,
                title: `${task.code}: ${task.title} — delay to ${proposedDueDate.toISOString().slice(0, 10)}`,
                projectId,
                stageId: task.stageId,
              },
              tx,
              ctx,
            );
            await tx.taskDelayRequest.update({
              where: { id: row.id },
              data: { approvalRequestId: request.id },
            });
            await audit(ctx, tx, "TaskDelayRequest", row.id, "CREATE");
          }
          await audit(ctx, tx, "Task", taskId, operation);
        },
        { timeout: 30000 },
      );
    } catch (error) {
      await Promise.allSettled(uploaded.map((key) => storage.delete(key)));
      throw error;
    }
    return undefined;
  });
}
