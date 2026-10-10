"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";

import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";

import { saveSeriesInput } from "../schema";
export async function saveSeriesAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "settings.manage");
    const input = saveSeriesInput.parse(Object.fromEntries(data));
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`series:${ctx.org.id}:${input.type}`}))::text`;
      await tx.$queryRaw`SELECT id FROM document_series WHERE "organizationId" = ${ctx.org.id} AND type = ${input.type} FOR UPDATE`;
      const existing = await tx.documentSeries.findUnique({
        where: {
          organizationId_type: { organizationId: ctx.org.id, type: input.type },
        },
      });
      if (existing && input.nextNumber < existing.nextNumber)
        throw new Error("The next number cannot move backwards.");
      const series = await tx.documentSeries.upsert({
        where: {
          organizationId_type: { organizationId: ctx.org.id, type: input.type },
        },
        create: { ...input, organizationId: ctx.org.id },
        update: input,
      });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "UPSERT",
          entityType: "DocumentSeries",
          entityId: series.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
