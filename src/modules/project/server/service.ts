import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { optional, value } from "@/core/form-data";
import { nextDocumentNumber } from "@/core/numbering";
import { lockStockProjects } from "@/modules/procurement/server/inventory/service";
import { validateProjectCostRecognitionChange } from "@/modules/project-cost/server/cost-recognition";
import { name, optionalMaterialCostRecognition, projectInput } from "../schema";
import { audit, dateOrder, member, nullableDate } from "./action-helpers";

export async function saveProject(org: string, _: ActionState, data: FormData) {
  return runAction(async () => {
    const projectId = optional(data, "id");
    const ctx = projectId
      ? await requireProjectContext(org, projectId)
      : await requireOrgContext(org);
    if (projectId && ctx.permissions.has("project.manage"))
      assertPermission(ctx, "project.manage");
    else assertPermission(ctx, projectId ? "project.edit" : "project.create");
    const input = projectInput.parse({
      ...Object.fromEntries(data),
      clientPartyId: optional(data, "clientPartyId"),
      managerUserId: optional(data, "managerUserId"),
    });
    const startDate = nullableDate(data, "startDate"),
      endDate = nullableDate(data, "endDate");
    dateOrder(startDate, endDate);
    const saved = await db.$transaction(async (tx) => {
      await member(ctx, tx, input.managerUserId);
      let clientPartyId = input.clientPartyId;
      if (
        clientPartyId &&
        !(await tx.party.findFirst({
          where: {
            id: clientPartyId,
            tenantId: ctx.tenant.id,
            isCustomer: true,
          },
        }))
      )
        throw new Error("Select a customer from this tenant.");
      if (optional(data, "customerName")) {
        const displayName = name.parse(value(data, "customerName"));
        const customer = await tx.party.create({
          data: {
            tenantId: ctx.tenant.id,
            code: `${ctx.org.slug}-${await nextDocumentNumber(ctx.org.id, "CUS", tx)}`,
            displayName,
            legalName: name.parse(
              optional(data, "customerLegalName") ?? displayName,
            ),
            isCustomer: true,
          },
        });
        clientPartyId = customer.id;
        await audit(ctx, tx, "Party", customer.id, "CREATE");
      }
      const materialCostRecognition = optionalMaterialCostRecognition.parse(
        optional(data, "materialCostRecognition") ?? undefined,
      );
      let oldMode: "ON_RECEIPT" | "ON_CONSUMPTION" | undefined;
      if (projectId && materialCostRecognition) {
        if (
          !ctx.isAdmin &&
          !ctx.permissions.has("project.edit") &&
          !ctx.permissions.has("project.manage")
        )
          assertPermission(ctx, "project.settings.manage");
        await lockStockProjects(tx, ctx.org.id, [projectId]);
        oldMode = await validateProjectCostRecognitionChange(
          tx,
          ctx.org.id,
          projectId,
          materialCostRecognition,
          data.get("confirmCostRecognitionChange") === "on",
        );
      }
      const fields = {
        ...input,
        clientPartyId,
        startDate,
        endDate,
        ...(materialCostRecognition ? { materialCostRecognition } : {}),
      };
      const row = projectId
        ? await tx.project.update({ where: { id: projectId }, data: fields })
        : await tx.project.create({
            data: {
              ...fields,
              organizationId: ctx.org.id,
              code: await nextDocumentNumber(ctx.org.id, "PRJ", tx),
            },
          });
      await audit(ctx, tx, "Project", row.id, projectId ? "UPDATE" : "CREATE");
      if (oldMode && oldMode !== row.materialCostRecognition)
        await audit(
          ctx,
          tx,
          "Project",
          row.id,
          "MATERIAL_COST_RECOGNITION_CHANGED",
          {
            oldValue: oldMode,
            newValue: row.materialCostRecognition,
            futureTransactionsOnly: true,
          },
        );
      return row;
    });
    return projectId ? undefined : `/${org}/projects/${saved.id}`;
  });
}
