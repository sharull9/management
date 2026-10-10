import "server-only";
import { writeAudit } from "@/core/audit";
import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";

export async function auditEffect(
  tx: Prisma.TransactionClient,
  request: ApprovalRequest,
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      organizationId: request.organizationId,
      userId: actorId,
      entityType,
      entityId,
      action,
      changes: { approvalRequestId: request.id },
    },
    tx,
  );
}
