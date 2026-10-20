import { Decimal, money } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import type { requestInput } from "../schema";

import {
  domainAudit,
  lockDocument,
  projectScope,
  selectedVariant,
} from "./service";
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
    if (old.status !== "DRAFT")
      throw new UserFacingError("Only drafts can be edited.");
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
