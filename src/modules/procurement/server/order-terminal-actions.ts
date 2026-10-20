"use server";

import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { typedAction } from "@/core/typed-action";
import { orderTerminalInput } from "../order-terminal-schema";
import { changePurchaseOrderStatus } from "./order-terminal-service";

export async function changePurchaseOrderStatusAction(
  org: string,
  raw: z.input<typeof orderTerminalInput>,
) {
  return typedAction(orderTerminalInput, async (input) => {
    const order = await db.purchaseOrder.findFirstOrThrow({
      where: { id: id.parse(input.id), organization: { slug: org } },
      select: { projectId: true },
    });
    const ctx = await requireProjectContext(org, order.projectId);
    assertPermission(ctx, "purchase.order.create");
    await db.$transaction((tx) => changePurchaseOrderStatus(tx, ctx, input), {
      timeout: 20000,
    });
    return undefined;
  })(raw);
}
