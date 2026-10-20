import { UserFacingError } from "@/core/errors";
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
import {
  audit,
  canManageProjectApprovers,
  dateOrder,
  member,
} from "./action-helpers";

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
  const canManageApprovers = canManageProjectApprovers(ctx);
  dateOrder(startDate, endDate);
  const saved = await db.$transaction(async (tx) => {
    const current = projectId
      ? await tx.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { managerUserId: true, currency: true },
        })
      : null;
    if (!projectId && !canManageApprovers && input.managerUserId)
      throw new UserFacingError(
        "Project management, project settings management, or administrator access is required to assign the project manager.",
      );
    const managerUserId =
      projectId && !canManageApprovers
        ? (current?.managerUserId ?? null)
        : input.managerUserId;
    if (
      projectId &&
      !canManageApprovers &&
      managerUserId !== input.managerUserId
    )
      throw new UserFacingError(
        "Project management, project settings management, or administrator access is required to change the project manager.",
      );
    await member(ctx, tx, managerUserId);
    if (projectId) {
      if (!current) throw new UserFacingError("Project not found.");
      const costEntries = await tx.costEntry.count({ where: { projectId } });
      const blocked = projectCurrencyChangeError({
        current: current.currency,
        next: input.currency,
        costEntries,
      });
      if (blocked) throw new UserFacingError(blocked);
      if (current.currency !== input.currency)
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
      throw new UserFacingError("Select a customer from this tenant.");
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
      managerUserId,
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
