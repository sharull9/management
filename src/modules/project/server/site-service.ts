import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import type { deleteInput, siteFormInput } from "../schema";
import { audit } from "./action-helpers";

export async function site(
  org: string,
  projectId: string,
  data: z.output<typeof siteFormInput> | z.output<typeof deleteInput>,
  remove = false,
) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "project.edit");
  await db.$transaction(async (tx) => {
    const siteId = data.id;
    if (siteId)
      await tx.projectSite.findFirstOrThrow({
        where: { id: siteId, projectId },
      });
    if (remove && siteId) {
      await tx.projectSite.delete({ where: { id: siteId } });
      await audit(ctx, tx, "ProjectSite", siteId, "DELETE");
    } else {
      if (!("name" in data)) throw new Error("Site fields are required.");
      const { id: _id, ...input } = data;
      if (input.countryId)
        await tx.country.findUniqueOrThrow({
          where: { id: input.countryId },
        });
      if (input.stateId)
        await tx.state.findFirstOrThrow({
          where: { id: input.stateId, countryId: input.countryId ?? "" },
        });
      if (input.cityId)
        await tx.city.findFirstOrThrow({
          where: {
            id: input.cityId,
            stateId: input.stateId ?? "",
            tenantId: ctx.tenant.id,
          },
        });
      const fields = input;
      const row = siteId
        ? await tx.projectSite.update({ where: { id: siteId }, data: fields })
        : await tx.projectSite.create({ data: { ...fields, projectId } });
      await audit(ctx, tx, "ProjectSite", row.id, siteId ? "UPDATE" : "CREATE");
    }
  });
  return undefined;
}
