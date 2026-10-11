import { Decimal } from "@/core/decimal";
import "server-only";
import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { getProjectCostRecognition } from "@/modules/project-cost/server/cost-recognition";
import { materialCostEffects } from "@/modules/project-cost-policy/util";
import { movingAverage } from "@/modules/stock-valuation/util";
import { convertUom } from "@/modules/uom/util";
import type { consumptionInput, transferInput } from "../../schema";
import {
  domainAudit,
  lockDocument,
  projectScope,
  selectedVariant,
} from "../service";

export async function lockStockProjects(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectIds: string[],
) {
  for (const projectId of [...new Set(projectIds)].sort())
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${orgId}:${projectId}`}))::text`;
}
export async function stockBalance(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string,
  itemVariantId: string,
) {
  const sum = await tx.stockMovement.aggregate({
    where: { organizationId: orgId, projectId, itemVariantId },
    _sum: { qty: true, totalCost: true },
  });
  const qty = new Decimal(sum._sum.qty ?? "0"),
    value = new Decimal(sum._sum.totalCost ?? "0");
  return { qty, value, avgCost: qty.gt(0) ? value.div(qty) : new Decimal(0) };
}
export async function assertStockDate(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string,
  itemVariantId: string,
  date: Date,
) {
  if (
    await tx.stockMovement.findFirst({
      where: {
        organizationId: orgId,
        projectId,
        itemVariantId,
        date: { gt: date },
      },
    })
  )
    throw new Error(
      "Stock movements cannot predate an existing movement for this project and variant.",
    );
}
export async function recordConsumption(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof consumptionInput>,
) {
  await projectScope(tx, ctx, input.projectId, input.stageId, input.taskId);
  await lockStockProjects(tx, ctx.org.id, [input.projectId]);
  const costRecognition = await getProjectCostRecognition(tx, input.projectId);
  const row = await tx.materialConsumption.create({
    data: {
      organizationId: ctx.org.id,
      projectId: input.projectId,
      stageId: input.stageId,
      taskId: input.taskId,
      date: input.date,
      recordedById: ctx.user.id,
      code: await nextDocumentNumber(ctx.org.id, "MC", tx),
    },
  });
  for (const line of input.lines) {
    const { variant, item, uom } = await selectedVariant(tx, ctx, line, true);
    const stockQty = convertUom(line.qty, uom, item.stockUom);
    await assertStockDate(
      tx,
      ctx.org.id,
      input.projectId,
      variant.id,
      input.date,
    );
    const balance = await stockBalance(
      tx,
      ctx.org.id,
      input.projectId,
      variant.id,
    );
    const posting = movingAverage(balance, { qty: stockQty.neg() });
    const saved = await tx.materialConsumptionLine.create({
      data: {
        consumptionId: row.id,
        itemVariantId: variant.id,
        qty: line.qty,
        uomId: uom.id,
        stockQty,
        unitCost: posting.unitCost,
        totalCost: posting.totalCost.neg(),
      },
    });
    const movement = await tx.stockMovement.create({
      data: {
        organizationId: ctx.org.id,
        projectId: input.projectId,
        itemVariantId: variant.id,
        date: input.date,
        type: "CONSUMPTION_OUT",
        qty: stockQty.neg(),
        unitCost: posting.unitCost,
        totalCost: posting.totalCost,
        sourceType: "CONSUMPTION",
        sourceId: saved.id,
        stageId: input.stageId,
        taskId: input.taskId,
      },
    });
    for (const effect of materialCostEffects({
      event: "CONSUMPTION",
      sourceMode: costRecognition,
      value: posting.totalCost.neg(),
    })) {
      const cost = await tx.costEntry.create({
        data: {
          organizationId: ctx.org.id,
          projectId: input.projectId,
          stageId: input.stageId,
          taskId: input.taskId,
          date: input.date,
          costType: "MATERIAL",
          amount: effect.amount,
          description: `${row.code} · ${variant.name}`,
          sourceType: "CONSUMPTION",
          sourceId: saved.id,
          createdById: ctx.user.id,
        },
      });
      await domainAudit(ctx, tx, "CostEntry", cost.id, "CREATE");
    }
    await domainAudit(ctx, tx, "StockMovement", movement.id, "CREATE");
  }
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "MaterialConsumption",
      entityId: row.id,
      action: "CREATE",
      changes: { costRecognition },
    },
    tx,
  );
  return row;
}
export async function saveStockTransfer(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof transferInput>,
) {
  const from = await projectScope(tx, ctx, input.projectId),
    to = await projectScope(tx, ctx, input.toProjectId);
  if (from.id === to.id)
    throw new Error("Choose a different destination project.");
  if (from.currency !== to.currency)
    throw new Error("Transfers require projects with the same currency.");
  if (input.id) {
    await lockDocument(tx, "ST", input.id);
    const old = await tx.stockTransfer.findFirstOrThrow({
      where: {
        id: input.id,
        organizationId: ctx.org.id,
        projectId: input.projectId,
      },
    });
    if (old.status !== "DRAFT")
      throw new Error("Only draft transfers can be edited.");
    await tx.stockTransferLine.deleteMany({ where: { transferId: old.id } });
  }
  const lines = [];
  for (const line of input.lines) {
    const { variant, item, uom } = await selectedVariant(tx, ctx, line, true);
    lines.push({
      itemVariantId: variant.id,
      qty: line.qty,
      uomId: uom.id,
      stockQty: convertUom(line.qty, uom, item.stockUom),
    });
  }
  const fields = { projectId: from.id, toProjectId: to.id, date: input.date };
  const row = input.id
    ? await tx.stockTransfer.update({
        where: { id: input.id },
        data: { ...fields, lines: { create: lines } },
      })
    : await tx.stockTransfer.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "ST", tx),
          createdById: ctx.user.id,
          lines: { create: lines },
        },
      });
  await domainAudit(
    ctx,
    tx,
    "StockTransfer",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
