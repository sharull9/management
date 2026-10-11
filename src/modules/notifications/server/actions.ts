"use server";
import type { z } from "zod";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { typedAction } from "@/core/typed-action";
import { markNotificationReadInput } from "../schema";

const markRead = typedAction(
  markNotificationReadInput,
  async ({ orgSlug, id }) => {
    const ctx = await requireOrgContext(orgSlug);
    await db.notification.updateMany({
      where: {
        id,
        tenantId: ctx.tenant.id,
        organizationId: ctx.org.id,
        userId: ctx.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return undefined;
  },
);

export async function markNotificationReadAction(
  input: z.input<typeof markNotificationReadInput>,
) {
  return markRead(input);
}
