import { Decimal, money } from "@/core/decimal";
import "server-only";
import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { resolveVariant } from "../masters/service";
import {
  assertReceiptQuantity,
  calculateTax,
  convertUom,
  suggestTaxScope,
} from "./calculations";
import type { orderInput, receiptInput, requestInput } from "./validation";

export async function domainAudit(
  ctx: OrgContext,
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
    },
    tx,
  );
}
export async function projectScope(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  projectId: string,
  stageId: string | null = null,
  taskId: string | null = null,
) {
  const project = await tx.project.findFirstOrThrow({
    where: { id: projectId, organizationId: ctx.org.id },
  });
  if (stageId)
    await tx.stage.findFirstOrThrow({ where: { id: stageId, projectId } });
  if (taskId)
    await tx.task.findFirstOrThrow({
      where: { id: taskId, projectId, ...(stageId ? { stageId } : {}) },
    });
  return project;
}
export async function siteInProject(
  tx: Prisma.TransactionClient,
  projectId: string,
  siteId: string | null,
) {
  if (siteId)
    await tx.projectSite.findFirstOrThrow({ where: { id: siteId, projectId } });
}
export async function selectedVariant(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  line: { itemId: string; levels: (string | null)[]; uomId: string },
  stockOnly = false,
) {
  const variant = await resolveVariant(
    tx,
    ctx.tenant.id,
    line.itemId,
    line.levels,
  );
  const item = await tx.item.findUniqueOrThrow({
    where: { id: variant.itemId },
    include: { stockUom: true },
  });
  if (stockOnly && !item.stockTracked)
    throw new Error(
      "Only stock-tracked items can be received, consumed or transferred.",
    );
  const uom = await tx.uom.findFirstOrThrow({
    where: {
      id: line.uomId,
      OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
    },
  });
  if (item.stockUom.groupId !== uom.groupId)
    throw new Error("Line unit must match the item's stock UOM group.");
  return { variant, item, uom };
}
export async function lockDocument(
  tx: Prisma.TransactionClient,
  type: string,
  documentId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${type}:${documentId}`}))::text`;
}
export async function savePurchaseRequest(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof requestInput>,
) {
  await projectScope(tx, ctx, input.projectId, input.stageId, input.taskId);
  if (input.id) {
    await lockDocument(tx, "PR", input.id);
    const old = await tx.purchaseRequest.findFirstOrThrow({
      where: {
        id: input.id,
        organizationId: ctx.org.id,
        projectId: input.projectId,
      },
    });
    if (old.status !== "DRAFT") throw new Error("Only drafts can be edited.");
  }
  const lines = [];
  for (const line of input.lines) {
    const { variant } = await selectedVariant(tx, ctx, line);
    lines.push({
      itemVariantId: variant.id,
      description: line.description,
      qty: line.qty,
      uomId: line.uomId,
      estimatedRate: line.estimatedRate,
      estimatedAmount: money(new Decimal(line.qty).mul(line.estimatedRate)),
    });
  }
  const fields = {
    projectId: input.projectId,
    stageId: input.stageId,
    taskId: input.taskId,
    neededBy: input.neededBy,
    estimatedTotal: lines.reduce(
      (a, l) => a.add(l.estimatedAmount),
      new Decimal(0),
    ),
  };
  if (input.id)
    await tx.purchaseRequestLine.deleteMany({ where: { requestId: input.id } });
  const row = input.id
    ? await tx.purchaseRequest.update({
        where: { id: input.id },
        data: { ...fields, lines: { create: lines } },
      })
    : await tx.purchaseRequest.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "PR", tx),
          requestedById: ctx.user.id,
          lines: { create: lines },
        },
      });
  await domainAudit(
    ctx,
    tx,
    "PurchaseRequest",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
export async function savePurchaseOrder(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof orderInput>,
) {
  const project = await projectScope(tx, ctx, input.projectId);
  await siteInProject(tx, input.projectId, input.siteId);
  if (input.currency !== project.currency)
    throw new Error("PO currency must match the project currency.");
  const vendor = await tx.party.findFirstOrThrow({
    where: { id: input.vendorPartyId, tenantId: ctx.tenant.id, isVendor: true },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
  });
  if (input.id) {
    await lockDocument(tx, "PO", input.id);
    const old = await tx.purchaseOrder.findFirstOrThrow({
      where: {
        id: input.id,
        organizationId: ctx.org.id,
        projectId: input.projectId,
      },
    });
    if (old.status !== "DRAFT") throw new Error("Only drafts can be edited.");
  }
  const linkedIds = input.lines
    .flatMap((l) => (l.prLineId ? [l.prLineId] : []))
    .sort();
  if (new Set(linkedIds).size !== linkedIds.length)
    throw new Error("Combine quantities for the same PR line.");
  for (const prLineId of linkedIds) await lockDocument(tx, "PR_LINE", prLineId);
  const lines = [];
  for (const line of input.lines) {
    const { variant, item, uom } = await selectedVariant(tx, ctx, line);
    if (line.prLineId) {
      const pr = await tx.purchaseRequestLine.findFirstOrThrow({
        where: {
          id: line.prLineId,
          request: {
            projectId: project.id,
            organizationId: ctx.org.id,
            status: "APPROVED",
          },
          itemVariantId: variant.id,
        },
        include: { uom: true },
      });
      const existing = await tx.purchaseOrderLine.findMany({
        where: {
          prLineId: pr.id,
          order: { status: { not: "CANCELLED" } },
          ...(input.id ? { orderId: { not: input.id } } : {}),
        },
        include: { uom: true },
      });
      const previously = existing.reduce(
        (a, l) => a.add(convertUom(l.qty, l.uom, pr.uom)),
        new Decimal(0),
      );
      if (previously.add(convertUom(line.qty, uom, pr.uom)).gt(pr.qty))
        throw new Error("Ordered quantity exceeds the approved PR quantity.");
    }
    const group = line.taxGroupId
      ? await tx.taxGroup.findFirstOrThrow({
          where: { id: line.taxGroupId, tenantId: ctx.tenant.id },
          include: {
            components: {
              include: { component: true },
              orderBy: { sequence: "asc" },
            },
          },
        })
      : null;
    if (
      group?.countryId &&
      ctx.org.countryId &&
      group.countryId !== ctx.org.countryId
    )
      throw new Error("Tax group country differs from the organization.");
    const suggestedScope = suggestTaxScope(
      ctx.org.stateId,
      vendor.addresses[0]?.stateId ?? null,
    );
    if (
      group &&
      group.scope !== "ANY" &&
      suggestedScope !== "ANY" &&
      group.scope !== suggestedScope
    )
      throw new Error(
        "Tax group scope differs from the organization and vendor states.",
      );
    const netRate = new Decimal(line.rate).mul(
      new Decimal(1).sub(new Decimal(line.discountPercent).div(100)),
    );
    const netAmount = money(new Decimal(line.qty).mul(netRate));
    const taxes = calculateTax(
      netAmount,
      group?.components.map((c) => c.component) ?? [],
    );
    const stockFactor = new Decimal(uom.factor).div(item.stockUom.factor);
    if (!stockFactor.eq(stockFactor.toDecimalPlaces(8)))
      throw new Error("UOM conversion factor exceeds snapshot precision.");
    lines.push({
      itemVariantId: variant.id,
      description: line.description || variant.name,
      qty: line.qty,
      uomId: uom.id,
      rate: line.rate,
      discountPercent: line.discountPercent,
      netRate: netRate.toDecimalPlaces(8),
      netAmount,
      prLineId: line.prLineId,
      taxGroupId: line.taxGroupId,
      stockFactor,
      stockUomId: item.stockUomId,
      taxes: { create: taxes.lines },
    });
  }
  const subtotal = lines.reduce((a, l) => a.add(l.netAmount), new Decimal(0));
  const taxTotal = lines
    .flatMap((l) => l.taxes.create)
    .filter((l) => !l.isWithholding)
    .reduce((a, l) => a.add(l.amount), new Decimal(0));
  const withholdingTotal = lines
    .flatMap((l) => l.taxes.create)
    .filter((l) => l.isWithholding)
    .reduce((a, l) => a.add(l.amount), new Decimal(0));
  if (input.id) {
    await tx.purchaseOrderLineTax.deleteMany({
      where: { line: { orderId: input.id } },
    });
    await tx.purchaseOrderLine.deleteMany({ where: { orderId: input.id } });
  }
  const fields = {
    projectId: project.id,
    vendorPartyId: vendor.id,
    date: input.date,
    siteId: input.siteId,
    paymentTerms: input.paymentTerms,
    paymentDays: input.paymentDays,
    currency: input.currency,
    receiptTolerancePercent: input.receiptTolerancePercent,
    subtotal,
    taxTotal,
    withholdingTotal,
    grandTotal: subtotal.add(taxTotal).sub(withholdingTotal),
  };
  const row = input.id
    ? await tx.purchaseOrder.update({
        where: { id: input.id },
        data: { ...fields, lines: { create: lines } },
      })
    : await tx.purchaseOrder.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "PO", tx),
          createdById: ctx.user.id,
          lines: { create: lines },
        },
      });
  await domainAudit(
    ctx,
    tx,
    "PurchaseOrder",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
export async function saveGoodsReceipt(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof receiptInput>,
) {
  await projectScope(tx, ctx, input.projectId);
  await siteInProject(tx, input.projectId, input.siteId);
  if (input.id) {
    await lockDocument(tx, "GRN", input.id);
    const old = await tx.goodsReceipt.findFirstOrThrow({
      where: {
        id: input.id,
        organizationId: ctx.org.id,
        projectId: input.projectId,
      },
    });
    if (old.status !== "DRAFT") throw new Error("Only drafts can be edited.");
  }
  const order = await tx.purchaseOrder.findFirstOrThrow({
    where: {
      id: input.poId,
      organizationId: ctx.org.id,
      projectId: input.projectId,
      status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
    },
    include: {
      lines: { include: { uom: true, variant: { include: { item: true } } } },
    },
  });
  if (new Set(input.lines.map((l) => l.poLineId)).size !== input.lines.length)
    throw new Error("Combine quantities for each PO line.");
  for (const line of input.lines) {
    const po = order.lines.find((l) => l.id === line.poLineId);
    if (!po) throw new Error("Invalid PO line.");
    if (!po.variant.item.stockTracked)
      throw new Error("Service/non-stock lines do not use GRNs.");
    if (line.uomId !== po.uomId)
      throw new Error("Receive in the PO line unit.");
    assertReceiptQuantity(
      po.qty,
      po.receivedQty,
      line.receivedQty,
      order.receiptTolerancePercent,
    );
  }
  if (input.id)
    await tx.goodsReceiptLine.deleteMany({ where: { receiptId: input.id } });
  const fields = {
    projectId: input.projectId,
    poId: order.id,
    siteId: input.siteId,
    receivedDate: input.receivedDate,
    challanNumber: input.challanNumber,
    vehicleNumber: input.vehicleNumber,
  };
  const row = input.id
    ? await tx.goodsReceipt.update({
        where: { id: input.id },
        data: { ...fields, lines: { create: input.lines } },
      })
    : await tx.goodsReceipt.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "GRN", tx),
          receivedById: ctx.user.id,
          lines: { create: input.lines },
        },
      });
  await domainAudit(
    ctx,
    tx,
    "GoodsReceipt",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
