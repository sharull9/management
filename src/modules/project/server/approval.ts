import "server-only";
import type {
  ApprovalRequest,
  ApproverType,
  Prisma,
} from "@/generated/prisma/client";
import { managerApprovers } from "@/modules/approvals";
export async function resolveProjectManagers(
  request: ApprovalRequest,
  type: ApproverType,
  tx: Prisma.TransactionClient,
): Promise<string[] | null> {
  if (!request.projectId) return null;
  const project = await tx.project.findFirst({
    where: { id: request.projectId, organizationId: request.organizationId },
    include: { members: { where: { isManager: true } } },
  });
  if (!project) return null;
  if (type === "STAGE_MANAGER") {
    if (!request.stageId) return null;
    const stage = await tx.stage.findFirst({
      where: { id: request.stageId, projectId: project.id },
    });
    return managerApprovers(
      "STAGE_MANAGER",
      project.managerUserId,
      [],
      stage?.managerUserId,
    );
  }
  return managerApprovers(
    "PROJECT_MANAGER",
    project.managerUserId,
    project.members.map((m) => m.userId),
  );
}
