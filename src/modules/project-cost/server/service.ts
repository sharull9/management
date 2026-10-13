import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { nextDocumentNumber } from "@/core/numbering";
import { resolveDocumentFx } from "@/modules/currency/server/rates";
import { lockStockProjects } from "@/modules/procurement/server/inventory/service";
import { audit, stageInProject } from "@/modules/project/server/action-helpers";
import type { costRecognitionInput, createExpenseInput } from "../schema";
import { validateProjectCostRecognitionChange } from "./cost-recognition";

export async function saveProjectCostRecognition(
  org: string,
  projectId: string,
  input: z.output<typeof costRecognitionInput>,
) {
  const ctx = await requireProjectContext(org, projectId);
  if (
    !ctx.isAdmin &&
    !ctx.permissions.has("project.edit") &&
    !ctx.permissions.has("project.manage")
  )
    assertPermission(ctx, "project.settings.manage");
  const newMode = input.materialCostRecognition;
  await db.$transaction(async (tx) => {
    await lockStockProjects(tx, ctx.org.id, [projectId]);
    const oldMode = await validateProjectCostRecognitionChange(
      tx,
      ctx.org.id,
      projectId,
      newMode,
      input.confirmCostRecognitionChange,
    );
    if (oldMode === newMode) return;
    await tx.project.update({
      where: { id: projectId },
      data: { materialCostRecognition: newMode },
    });
    await audit(
      ctx,
      tx,
      "Project",
      projectId,
      "MATERIAL_COST_RECOGNITION_CHANGED",
      { oldValue: oldMode, newValue: newMode, futureTransactionsOnly: true },
    );
  });
  return undefined;
}
export async function expense(
  org: string,
  projectId: string,
  input: z.output<typeof createExpenseInput>,
) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "expense.create");
  await db.$transaction(async (tx) => {
    await stageInProject(tx, projectId, input.stageId);
    if (input.taskId) {
      const task = await tx.task.findFirstOrThrow({
        where: { id: input.taskId, projectId },
      });
      if (input.stageId && input.stageId !== task.stageId)
        throw new Error("Task does not belong to selected stage.");
      input.stageId = task.stageId;
    }
    if (input.partyId)
      await tx.party.findFirstOrThrow({
        where: { id: input.partyId, tenantId: ctx.tenant.id },
      });
    const fx = await resolveDocumentFx(tx, {
      organizationId: ctx.org.id,
      currency: ctx.project.currency,
      date: input.date,
    });
    const row = await tx.expense.create({
      data: {
        ...input,
        projectId,
        date: input.date,
        currency: ctx.project.currency,
        exchangeRate: fx.exchangeRate,
        baseAmount: fx.toBase(input.amount),
        createdById: ctx.user.id,
        code: await nextDocumentNumber(ctx.org.id, "EXP", tx),
      },
    });
    const { submitForApproval } = await import(
      "@/modules/approvals/server/service"
    );
    const request = await submitForApproval(
      {
        orgSlug: org,
        documentType: "EXPENSE",
        documentId: row.id,
        title: `${row.code}: ${row.description}`,
        amount: row.amount.toString(),
        projectId,
        stageId: row.stageId,
      },
      tx,
      ctx,
    );
    await tx.expense.update({
      where: { id: row.id },
      data: { approvalRequestId: request.id },
    });
    await audit(ctx, tx, "Expense", row.id, "CREATE");
  });
  return undefined;
}
