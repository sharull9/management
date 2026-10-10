import "server-only";
import type { ApprovalRequest } from "@/generated/prisma/client";
import { db } from "../db";
export async function approvalDocumentLinks(
  org: string,
  requests: Pick<
    ApprovalRequest,
    "id" | "organizationId" | "documentType" | "documentId" | "projectId"
  >[],
) {
  const links = await Promise.all(
    requests.map(async (r) => {
      if (!r.projectId) return [r.id, `/${org}/approvals`] as const;
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
      return [
        r.id,
        taskId
          ? `/${org}/projects/${r.projectId}/tasks/${taskId}`
          : `/${org}/projects/${r.projectId}/costs`,
      ] as const;
    }),
  );
  return new Map(links);
}
