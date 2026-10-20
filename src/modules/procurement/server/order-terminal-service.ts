import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { assertPermission } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import type { orderTerminalInput } from "../order-terminal-schema";
import { domainAudit, lockDocument, projectScope } from "./service";

export async function changePurchaseOrderStatus(
  tx: Prisma.TransactionClient,
  ctx: OrgContext & { project: { id: string } },
  input: z.output<typeof orderTerminalInput>,
) {
  assertPermission(ctx, "purchase.order.create");
  await lockDocument(tx, "PO", input.id);

  const order = await tx.purchaseOrder.findFirstOrThrow({
    where: { id: input.id, organizationId: ctx.org.id },
    include: { lines: { select: { receivedQty: true } } },
  });
  const project = await projectScope(tx, ctx, order.projectId);
  if (ctx.project.id !== project.id)
    throw new UserFacingError(
      "Purchase order is outside the authorized project.",
    );

  const target = input.action === "CLOSE" ? "CLOSED" : "CANCELLED";
  if (order.status === target) return order;

  if (input.action === "CANCEL") {
    if (order.status !== "DRAFT" && order.status !== "APPROVED")
      throw new UserFacingError(
        "Only draft or approved purchase orders can be cancelled.",
      );
    if (order.lines.some((line) => line.receivedQty.gt(0)))
      throw new UserFacingError(
        "A purchase order with received quantities cannot be cancelled.",
      );
    const [receipt, bill] = await Promise.all([
      tx.goodsReceipt.findFirst({
        where: {
          poId: order.id,
          organizationId: ctx.org.id,
          status: { not: "CANCELLED" },
        },
        select: { id: true },
      }),
      tx.vendorBill.findFirst({
        where: {
          purchaseOrderId: order.id,
          organizationId: ctx.org.id,
          status: { not: "CANCELLED" },
        },
        select: { id: true },
      }),
    ]);
    if (receipt || bill)
      throw new UserFacingError(
        "Purchase orders with active receipts or bills cannot be cancelled.",
      );
  } else {
    if (!["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(order.status))
      throw new UserFacingError(
        "Only approved or received purchase orders can be closed.",
      );
    const pendingReceipt = await tx.goodsReceipt.findFirst({
      where: {
        poId: order.id,
        organizationId: ctx.org.id,
        status: { in: ["DRAFT", "PENDING_APPROVAL"] },
      },
      select: { id: true },
    });
    if (pendingReceipt)
      throw new UserFacingError(
        "Purchase orders with draft or pending receipts cannot be closed.",
      );
  }

  const updated = await tx.purchaseOrder.update({
    where: { id: order.id },
    data: { status: target },
  });
  await domainAudit(ctx, tx, "PurchaseOrder", order.id, input.action);
  return updated;
}
