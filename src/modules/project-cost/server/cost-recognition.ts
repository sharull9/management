import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  assertCostRecognitionChange,
  type MaterialCostMode,
} from "@/modules/project-cost-policy/util";

// Callers must authorize the project before reading its recognition setting.
export async function getProjectCostRecognition(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<"ON_RECEIPT" | "ON_CONSUMPTION"> {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { materialCostRecognition: true },
  });
  return project.materialCostRecognition;
}

// Call under the project's stock lock, shared with receipt/consumption/transfer posting.
export async function validateProjectCostRecognitionChange(
  tx: Prisma.TransactionClient,
  organizationId: string,
  projectId: string,
  newMode: MaterialCostMode,
  confirmed: boolean,
) {
  const project = await tx.project.findFirstOrThrow({
    where: { id: projectId, organizationId },
    select: { materialCostRecognition: true },
  });
  const oldMode = project.materialCostRecognition;
  const hasStockMovements =
    oldMode !== newMode &&
    !!(await tx.stockMovement.findFirst({
      where: { organizationId, projectId },
      select: { id: true },
    }));
  assertCostRecognitionChange({
    oldMode,
    newMode,
    hasStockMovements,
    confirmed,
  });
  return oldMode;
}
