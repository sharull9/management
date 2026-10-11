"use server";

import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { typedAction } from "@/core/typed-action";

import { saveSeriesInput } from "../schema";
export async function saveSeriesAction(
  orgSlug: string,
  input: z.input<typeof saveSeriesInput>,
) {
  return typedAction(saveSeriesInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "settings.manage");
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
  })(input);
}
