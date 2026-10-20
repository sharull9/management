"use server";
import { z as zod } from "zod";
import { actionFailure } from "@/core/action-result";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { typedAction } from "@/core/typed-action";
import {
  type HistoryCursor,
  syncAccountingHistoryBatch,
} from "./history-service";

const cursorSchema = zod.object({
  organizationId: zod.string().min(1).max(100),
  category: zod.enum(["stock", "bill", "invoice", "payment", "cost"]),
  afterId: zod.string().max(100),
});

export async function syncHistoryAction(
  org: string,
  raw: Record<string, never>,
) {
  return typedAction(zod.object({}), async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "accounting.manage");
    let cursor: HistoryCursor | null = null;
    let done = false;
    while (!done) {
      const progress = await db.$transaction(
        (tx) => syncAccountingHistoryBatch(tx, ctx, cursor),
        {
          timeout: 30000,
          maxWait: 10000,
        },
      );
      cursor = progress.nextCursor;
      done = progress.done;
    }
  })(raw as never);
}

export async function syncHistoryBatchAction(
  org: string,
  raw: { cursor?: zod.input<typeof cursorSchema> | null },
) {
  try {
    const { cursor } = zod
      .object({ cursor: cursorSchema.nullable().optional() })
      .parse(raw);
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "accounting.manage");
    return await db.$transaction(
      (tx) => syncAccountingHistoryBatch(tx, ctx, cursor),
      {
        timeout: 30000,
        maxWait: 10000,
      },
    );
  } catch (error) {
    return actionFailure(error);
  }
}
