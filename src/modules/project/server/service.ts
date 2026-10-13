import "server-only";
import type { z } from "zod";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { nextDocumentNumber } from "@/core/numbering";
import { assertEnabledCurrency } from "@/modules/currency/server/enabled";
import { lockStockProjects } from "@/modules/procurement/server/inventory/service";
import { validateProjectCostRecognitionChange } from "@/modules/project-cost/server/cost-recognition";
import { projectCurrencyChangeError } from "../currency-guard";
import type { projectFormInput } from "../schema";
import { audit, dateOrder, member } from "./action-helpers";

export async function saveProject(
  org: string,
  data: z.output<typeof projectFormInput>,
) {
  const {
    id: projectId,
    startDate,
    endDate,
    customerName,
    customerLegalName,
    materialCostRecognition,
    confirmCostRecognitionChange,
    ...input
  } = data;
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  if (projectId && ctx.permissions.has("project.manage"))
    assertPermission(ctx, "project.manage");
  else assertPermission(ctx, projectId ? "project.edit" : "project.create");
  dateOrder(startDate, endDate);
  const saved = await db.$transaction(async (tx) => {
    await member(ctx, tx, input.managerUserId);
    if (projectId) {
      const [{ currency: current }, costEntries] = await Promise.all([
        tx.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { currency: true },
        }),
        tx.costEntry.count({ where: { projectId } }),
      ]);
      const blocked = projectCurrencyChangeError({
        current,
        next: input.currency,
        costEntries,
      });
      if (blocked) throw new Error(blocked);
      if (current !== input.currency)
        await assertEnabledCurrency(
          tx,
          ctx.tenant.id,
          input.currency,
          ctx.org.baseCurrency,
        );
    } else
      await assertEnabledCurrency(
        tx,
        ctx.tenant.id,
        input.currency,
        ctx.org.baseCurrency,
      );
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
    if (customerName) {
      const displayName = customerName;
      const customer = await tx.party.create({
        data: {
          tenantId: ctx.tenant.id,
          code: `${ctx.org.slug}-${await nextDocumentNumber(ctx.org.id, "CUS", tx)}`,
          displayName,
          legalName: customerLegalName || displayName,
          isCustomer: true,
        },
      });
      clientPartyId = customer.id;
      await audit(ctx, tx, "Party", customer.id, "CREATE");
    }
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
        confirmCostRecognitionChange,
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
}
