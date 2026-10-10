import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { optional } from "@/core/form-data";
import { coordinateInput, siteInput } from "../schema";
import { audit } from "./action-helpers";

export async function site(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "project.edit");
    await db.$transaction(async (tx) => {
      const siteId = optional(data, "id");
      if (siteId)
        await tx.projectSite.findFirstOrThrow({
          where: { id: siteId, projectId },
        });
      if (data.get("operation") === "DELETE" && siteId) {
        await tx.projectSite.delete({ where: { id: siteId } });
        await audit(ctx, tx, "ProjectSite", siteId, "DELETE");
      } else {
        const coordinate = (key: string, limit: number) =>
          coordinateInput(limit).parse(optional(data, key));
        const input = siteInput.parse({
          ...Object.fromEntries(data),
          pincode: optional(data, "pincode"),
          countryId: optional(data, "countryId"),
          stateId: optional(data, "stateId"),
          cityId: optional(data, "cityId"),
        });
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
        const fields = {
          ...input,
          latitude: coordinate("latitude", 90),
          longitude: coordinate("longitude", 180),
        };
        const row = siteId
          ? await tx.projectSite.update({ where: { id: siteId }, data: fields })
          : await tx.projectSite.create({ data: { ...fields, projectId } });
        await audit(
          ctx,
          tx,
          "ProjectSite",
          row.id,
          siteId ? "UPDATE" : "CREATE",
        );
      }
    });
    return undefined;
  });
}
