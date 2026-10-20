import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { nextDocumentNumber } from "@/core/numbering";
import { assertEnabledCurrency } from "@/modules/currency/server/enabled";
import { resolveDocumentFx } from "@/modules/currency/server/rates";
import { lockStockProjects } from "@/modules/procurement/server/inventory/service";
import { audit, stageInProject } from "@/modules/project/server/action-helpers";
import type { costRecognitionInput, createExpenseInput } from "../schema";
import { assertCurrencyPrecision, expenseBaseAmount } from "../util";
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
        throw new UserFacingError("Task does not belong to selected stage.");
      input.stageId = task.stageId;
    }
    if (input.partyId)
      await tx.party.findFirstOrThrow({
        where: { id: input.partyId, tenantId: ctx.tenant.id },
      });
    const { currency, exchangeRate: override, ...fields } = input;
    const fx = await resolveDocumentFx(tx, {
      organizationId: ctx.org.id,
      currency,
      date: input.date,
      override,
    });
    await assertEnabledCurrency(tx, ctx.tenant.id, currency, fx.baseCurrency);
    const currencyRow = await tx.currency.findUniqueOrThrow({
      where: { code: currency },
      select: { decimals: true },
    });
    assertCurrencyPrecision(input.amount, currencyRow.decimals, currency);
    const baseAmount = expenseBaseAmount(
      input.amount,
      fx.exchangeRate,
      fx.baseDecimals,
    );
    const row = await tx.expense.create({
      data: {
        ...fields,
        projectId,
        currency,
        exchangeRate: fx.exchangeRate,
        baseAmount,
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
        // Approval policy thresholds are in the organization base currency.
        amount: baseAmount.toString(),
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
