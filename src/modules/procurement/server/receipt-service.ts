import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { resolveDocumentFx } from "@/modules/currency/server/rates";
import type { receiptInput } from "../schema";
import { assertReceiptQuantity } from "./calculations";

import {
  domainAudit,
  lockDocument,
  projectScope,
  siteInProject,
} from "./service";
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
    if (old.status !== "DRAFT")
      throw new UserFacingError("Only drafts can be edited.");
  }
  await lockDocument(tx, "PO", input.poId);
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
    throw new UserFacingError("Combine quantities for each PO line.");
  for (const line of input.lines) {
    const po = order.lines.find((l) => l.id === line.poLineId);
    if (!po) throw new UserFacingError("Invalid PO line.");
    if (!po.variant.item.stockTracked)
      throw new UserFacingError("Service/non-stock lines do not use GRNs.");
    if (line.uomId !== po.uomId)
      throw new UserFacingError("Receive in the PO line unit.");
    assertReceiptQuantity(
      po.qty,
      po.receivedQty,
      line.receivedQty,
      order.receiptTolerancePercent,
    );
  }
  if (input.id)
    await tx.goodsReceiptLine.deleteMany({ where: { receiptId: input.id } });
  // Receipts inherit the PO currency but carry their own rate for the receipt
  // date, which values the stock movement in base currency.
  const fx = await resolveDocumentFx(tx, {
    organizationId: ctx.org.id,
    currency: order.currency,
    date: input.receivedDate,
    override: input.exchangeRate,
  });
  const fields = {
    projectId: input.projectId,
    poId: order.id,
    currency: order.currency,
    exchangeRate: fx.exchangeRate,
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
