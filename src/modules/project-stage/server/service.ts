import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import {
  audit,
  dateOrder,
  member,
  nullableDate,
  stageInProject,
} from "@/modules/project";
import { id, stageInput } from "../schema";

export async function saveStage(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "stage.manage");
    const stageId = optional(data, "id");
    const input = stageInput.parse({
      ...Object.fromEntries(data),
      managerUserId: optional(data, "managerUserId"),
      budgetAmount: optional(data, "budgetAmount"),
    });
    const startDate = nullableDate(data, "startDate"),
      endDate = nullableDate(data, "endDate");
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
  });
}
export async function deleteStage(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "stage.manage");
    const stageId = id.parse(data.get("id"));
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
  });
}
