import "server-only";
import type { Prisma } from "@/generated/prisma/client";

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
