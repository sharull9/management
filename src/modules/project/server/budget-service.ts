import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import type {
  budgetLineInput,
  budgetLinesInput,
  deleteInput,
  totalBudgetInput,
} from "../schema";
import { audit, stageInProject } from "./action-helpers";

export async function budget(
  org: string,
  projectId: string,
  data:
    | z.output<typeof budgetLineInput>
    | z.output<typeof budgetLinesInput>
    | z.output<typeof totalBudgetInput>
    | z.output<typeof deleteInput>,
  remove = false,
) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "project.edit");
  await db.$transaction(async (tx) => {
    if ("lines" in data) {
      for (const input of data.lines) {
        await stageInProject(tx, projectId, input.stageId);
        const row = await tx.projectBudgetLine.create({
          data: { ...input, projectId },
        });
        await audit(ctx, tx, "ProjectBudgetLine", row.id, "CREATE");
      }
      return;
    }
    if ("budgetAmount" in data) {
      await tx.project.update({
        where: { id: projectId },
        data: { budgetAmount: data.budgetAmount },
      });
      await audit(ctx, tx, "Project", projectId, "BUDGET");
      return;
    }
    const lineId = data.id;
    if (lineId)
      await tx.projectBudgetLine.findFirstOrThrow({
        where: { id: lineId, projectId },
      });
    if (remove && lineId) {
      await tx.projectBudgetLine.delete({ where: { id: lineId } });
      await audit(ctx, tx, "ProjectBudgetLine", lineId, "DELETE");
    } else {
      if (!("costType" in data))
        throw new UserFacingError("Budget line fields are required.");
      const { id: _id, ...input } = data;
      await stageInProject(tx, projectId, input.stageId);
      const row = lineId
        ? await tx.projectBudgetLine.update({
            where: { id: lineId },
            data: input,
          })
        : await tx.projectBudgetLine.create({
            data: { ...input, projectId },
          });
      await audit(
        ctx,
        tx,
        "ProjectBudgetLine",
        row.id,
        lineId ? "UPDATE" : "CREATE",
      );
    }
  });
  return undefined;
}
