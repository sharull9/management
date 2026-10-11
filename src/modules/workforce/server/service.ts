import "server-only";
import type { z } from "zod";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { nextDocumentNumber } from "@/core/numbering";
import { audit } from "@/modules/project/server/action-helpers";
import type { designationInput, saveWorkerInput } from "../schema";

export async function saveWorker(
  org: string,
  parsed: z.output<typeof saveWorkerInput>,
) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "workforce.manage");
  const { id: workerId, ...input } = parsed;
  await db.$transaction(async (tx) => {
    if (workerId)
      await tx.worker.findFirstOrThrow({
        where: { id: workerId, organizationId: ctx.org.id },
      });
    if (input.designationId)
      await tx.designation.findFirstOrThrow({
        where: { id: input.designationId, tenantId: ctx.tenant.id },
      });
    const fields = {
      ...input,
      joinDate: input.joinDate,
      active: input.active,
    };
    const row = workerId
      ? await tx.worker.update({ where: { id: workerId }, data: fields })
      : await tx.worker.create({
          data: {
            ...fields,
            organizationId: ctx.org.id,
            code: await nextDocumentNumber(ctx.org.id, "WRK", tx),
          },
        });
    await audit(ctx, tx, "Worker", row.id, workerId ? "UPDATE" : "CREATE");
  });
  return undefined;
}
export async function designation(
  org: string,
  input: z.output<typeof designationInput>,
) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "workforce.manage");
  const designationId = input.id;
  await db.$transaction(async (tx) => {
    if (designationId)
      await tx.designation.findFirstOrThrow({
        where: { id: designationId, tenantId: ctx.tenant.id },
      });
    if (input.operation === "DELETE" && designationId) {
      await tx.designation.delete({ where: { id: designationId } });
      await audit(ctx, tx, "Designation", designationId, "DELETE");
    } else {
      if (input.operation !== "SAVE") throw new Error("Choose a designation.");
      const fields = { name: input.name };
      const row = designationId
        ? await tx.designation.update({
            where: { id: designationId },
            data: fields,
          })
        : await tx.designation.create({
            data: { ...fields, tenantId: ctx.tenant.id },
          });
      await audit(
        ctx,
        tx,
        "Designation",
        row.id,
        designationId ? "UPDATE" : "CREATE",
      );
    }
  });
  return undefined;
}
