import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { budgetInput, money } from "../schema";
import { audit, stageInProject } from "./action-helpers";

export async function budget(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "project.edit");
    await db.$transaction(async (tx) => {
      if (data.get("operation") === "TOTAL") {
        await tx.project.update({
          where: { id: projectId },
          data: { budgetAmount: money.parse(data.get("budgetAmount")) },
        });
        await audit(ctx, tx, "Project", projectId, "BUDGET");
        return;
      }
      const lineId = optional(data, "id");
      if (lineId)
        await tx.projectBudgetLine.findFirstOrThrow({
          where: { id: lineId, projectId },
        });
      if (data.get("operation") === "DELETE" && lineId) {
        await tx.projectBudgetLine.delete({ where: { id: lineId } });
        await audit(ctx, tx, "ProjectBudgetLine", lineId, "DELETE");
      } else {
        const input = budgetInput.parse({
          ...Object.fromEntries(data),
          stageId: optional(data, "stageId"),
        });
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
  });
}
