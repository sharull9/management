import "server-only";
import { db } from "@/core/db";
import type { ApprovalRequest } from "@/generated/prisma/client";
export async function resolveTaskApprovalDocumentId(
  r: Pick<
    ApprovalRequest,
    "id" | "organizationId" | "documentType" | "documentId" | "projectId"
  >,
): Promise<string | null> {
  if (!r.projectId) return null;

  let taskId: string | null = null;
  if (r.documentType === "TASK_SUBMISSION")
    taskId =
      (
        await db.taskSubmission.findFirst({
          where: {
            id: r.documentId,
            task: {
              projectId: r.projectId,
              project: { organizationId: r.organizationId },
            },
          },
          select: { taskId: true },
        })
      )?.taskId ?? null;
  if (r.documentType === "TASK_DELAY")
    taskId =
      (
        await db.taskDelayRequest.findFirst({
          where: {
            id: r.documentId,
            task: {
              projectId: r.projectId,
              project: { organizationId: r.organizationId },
            },
          },
          select: { taskId: true },
        })
      )?.taskId ?? null;

  return taskId;
}
