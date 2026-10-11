import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { nextDocumentNumber } from "@/core/numbering";
import { audit, nullableDate } from "@/modules/project/server/action-helpers";
import { name, workerInput } from "../schema";

export async function saveWorker(org: string, _: ActionState, data: FormData) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "workforce.manage");
    const workerId = optional(data, "id");
    const input = workerInput.parse({
      ...Object.fromEntries(data),
      phone: optional(data, "phone"),
      designationId: optional(data, "designationId"),
    });
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
        joinDate: nullableDate(data, "joinDate"),
        active: data.get("active") === "on",
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
  });
}
export async function designation(org: string, _: ActionState, data: FormData) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "workforce.manage");
    const designationId = optional(data, "id");
    await db.$transaction(async (tx) => {
      if (designationId)
        await tx.designation.findFirstOrThrow({
          where: { id: designationId, tenantId: ctx.tenant.id },
        });
      if (data.get("operation") === "DELETE" && designationId) {
        await tx.designation.delete({ where: { id: designationId } });
        await audit(ctx, tx, "Designation", designationId, "DELETE");
      } else {
        const fields = { name: name.parse(data.get("name")) };
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
  });
}
