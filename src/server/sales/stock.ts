import "server-only";
import type { Prisma, SalesInvoice } from "@/generated/prisma/client";
import { writeAudit } from "../audit";
import {
  convertUom,
  Decimal,
  movingAverage,
} from "../procurement/calculations";
import { validateStockLine } from "./calculations";
export async function postInvoiceStock(
  tx: Prisma.TransactionClient,
  invoice: SalesInvoice,
  actorId: string,
) {
  if (!invoice.projectId) {
    if (
      await tx.salesInvoiceLine.count({
        where: { invoiceId: invoice.id, fromProjectStock: true },
      })
    )
      throw new Error("Project required for stock sales.");
    return;
  }
  const project = await tx.project.findFirstOrThrow({
    where: { id: invoice.projectId, organizationId: invoice.organizationId },
  });
  const organization = await tx.organization.findUniqueOrThrow({
    where: { id: invoice.organizationId },
  });
  if (project.currency !== invoice.currency)
    throw new Error("Stock project currency differs from invoice.");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${invoice.organizationId}:${invoice.projectId}`}))::text`;
  const lines = await tx.salesInvoiceLine.findMany({
    where: { invoiceId: invoice.id, fromProjectStock: true },
    include: {
      uom: true,
      variant: { include: { item: { include: { stockUom: true } } } },
    },
    orderBy: { id: "asc" },
  });
  for (const line of lines) {
    const item = line.variant?.item;
    validateStockLine({
      ...line,
      projectId: invoice.projectId,
      itemType: item?.type,
      stockTracked: item?.stockTracked,
    });
    if (!item || !line.itemVariantId || line.stockMovementId)
      throw new Error("Invalid or already posted stock line.");
    if (item.tenantId !== organization.tenantId)
      throw new Error("Invalid stock item tenant.");
    if (
      await tx.stockMovement.findFirst({
        where: {
          organizationId: invoice.organizationId,
          projectId: invoice.projectId,
          itemVariantId: line.itemVariantId,
          date: { gt: invoice.date },
        },
      })
    )
      throw new Error("Stock sales cannot predate existing movements.");
    const sum = await tx.stockMovement.aggregate({
      where: {
        organizationId: invoice.organizationId,
        projectId: invoice.projectId,
        itemVariantId: line.itemVariantId,
      },
      _sum: { qty: true, totalCost: true },
    });
    const qty = convertUom(line.qty, line.uom, item.stockUom).neg();
    const posting = movingAverage(
      {
        qty: new Decimal(sum._sum.qty ?? "0"),
        value: new Decimal(sum._sum.totalCost ?? "0"),
      },
      { qty },
    );
    const movement = await tx.stockMovement.create({
      data: {
        organizationId: invoice.organizationId,
        projectId: invoice.projectId,
        itemVariantId: line.itemVariantId,
        date: invoice.date,
        type: "SALE_OUT",
        qty,
        unitCost: posting.unitCost,
        totalCost: posting.totalCost,
        sourceType: "SALES_INVOICE",
        sourceId: line.id,
      },
    });
    await tx.salesInvoiceLine.update({
      where: { id: line.id },
      data: { stockMovementId: movement.id },
    });
    await writeAudit(
      {
        tenantId: organization.tenantId,
        organizationId: invoice.organizationId,
        userId: actorId,
        entityType: "StockMovement",
        entityId: movement.id,
        action: "CREATE",
        changes: { invoiceId: invoice.id, invoiceLineId: line.id },
      },
      tx,
    );
  }
}
