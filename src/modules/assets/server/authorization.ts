import { UserFacingError } from "@/core/errors";
import "server-only";
import {
  assertPermission,
  type OrgContext,
  projectAccessWhere,
} from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";

export async function assertAssetProject(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  projectId: string,
) {
  assertPermission(ctx, "asset.log");
  if ("project" in ctx && (ctx.project as { id: string }).id !== projectId)
    throw new UserFacingError("You do not have access to this project.");
  const project = await tx.project.findFirst({
    where: {
      id: projectId,
      organizationId: ctx.org.id,
      ...projectAccessWhere(ctx),
    },
    select: { id: true },
  });
  if (!project)
    throw new UserFacingError("You do not have access to this project.");
}
