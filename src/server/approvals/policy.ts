import "server-only";
import type { DocumentType, Prisma } from "@/generated/prisma/client";
import { db } from "../db";
export type Scope = { projectId?: string | null; stageId?: string | null };
export async function resolvePolicy(
  orgId: string,
  documentType: DocumentType,
  scope: Scope = {},
  tx: Prisma.TransactionClient = db,
) {
  const policies = await tx.approvalPolicy.findMany({
    where: {
      organizationId: orgId,
      documentType,
      active: true,
      OR: [
        { projectId: null, stageId: null },
        ...(scope.projectId
          ? [{ projectId: scope.projectId, stageId: null }]
          : []),
        ...(scope.projectId && scope.stageId
          ? [{ projectId: scope.projectId, stageId: scope.stageId }]
          : []),
      ],
    },
    include: { steps: { orderBy: { sequence: "asc" } } },
  });
  return (
    policies.sort(
      (a, b) =>
        (b.stageId ? 2 : b.projectId ? 1 : 0) -
        (a.stageId ? 2 : a.projectId ? 1 : 0),
    )[0] ?? null
  );
}
