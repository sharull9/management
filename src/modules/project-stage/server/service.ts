import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import {
  audit,
  canManageProjectApprovers,
  dateOrder,
  member,
  stageInProject,
} from "@/modules/project/server/action-helpers";
import type { deleteStageInput, stageFormInput } from "../schema";

export async function saveStage(
  org: string,
  projectId: string,
  data: z.output<typeof stageFormInput>,
) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "stage.manage");
  const { id: stageId, startDate, endDate, ...input } = data;
  const canManageApprovers = canManageProjectApprovers(ctx);
  dateOrder(startDate, endDate);
  await db.$transaction(async (tx) => {
    await stageInProject(tx, projectId, stageId);
    const current = stageId
      ? await tx.stage.findUniqueOrThrow({
          where: { id: stageId },
          select: { managerUserId: true },
        })
      : null;
    if (
      !canManageApprovers &&
      input.managerUserId !== (current?.managerUserId ?? null)
    )
      throw new UserFacingError(
        "Only project managers or administrators may change the stage manager.",
      );
    const managerUserId = canManageApprovers
      ? input.managerUserId
      : (current?.managerUserId ?? null);
    await member(ctx, tx, managerUserId);
    const row = stageId
      ? await tx.stage.update({
          where: { id: stageId },
          data: { ...input, managerUserId, startDate, endDate },
        })
      : await tx.stage.create({
          data: { ...input, managerUserId, startDate, endDate, projectId },
        });
    await audit(ctx, tx, "Stage", row.id, stageId ? "UPDATE" : "CREATE");
  });
  return undefined;
}
export async function deleteStage(
  org: string,
  projectId: string,
  data: z.output<typeof deleteStageInput>,
) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "stage.manage");
  const stageId = data.id;
  await db.$transaction(async (tx) => {
    await stageInProject(tx, projectId, stageId);
    const references = await tx.stage.findUniqueOrThrow({
      where: { id: stageId },
      select: {
        _count: {
          select: {
            tasks: true,
            budgetLines: true,
            expenses: true,
            costs: true,
            policies: true,
            requests: true,
          },
        },
      },
    });
    if (Object.values(references._count).some((count) => count > 0))
      throw new UserFacingError("Referenced stages cannot be deleted.");
    await tx.stage.delete({ where: { id: stageId } });
    await audit(ctx, tx, "Stage", stageId, "DELETE");
  });
  return undefined;
}
