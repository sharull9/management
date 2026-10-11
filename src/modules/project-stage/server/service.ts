import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import {
  audit,
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
  dateOrder(startDate, endDate);
  await db.$transaction(async (tx) => {
    await stageInProject(tx, projectId, stageId);
    await member(ctx, tx, input.managerUserId);
    const row = stageId
      ? await tx.stage.update({
          where: { id: stageId },
          data: { ...input, startDate, endDate },
        })
      : await tx.stage.create({
          data: { ...input, startDate, endDate, projectId },
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
      throw new Error("Referenced stages cannot be deleted.");
    await tx.stage.delete({ where: { id: stageId } });
    await audit(ctx, tx, "Stage", stageId, "DELETE");
  });
  return undefined;
}
