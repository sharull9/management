import "server-only";
import { writeAudit } from "@/core/audit";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
export async function auditApprovalEffect(
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
  actorId: string,
) {
  await writeAudit(
    {
      organizationId: request.organizationId,
      userId: actorId,
      action,
      entityType,
      entityId,
      changes: { approvalRequestId: request.id },
    },
    tx,
  );
}
