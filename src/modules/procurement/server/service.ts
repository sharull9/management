import "server-only";
import { writeAudit } from "@/core/audit";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { resolveVariant } from "@/modules/masters";

export async function domainAudit(
  ctx: OrgContext,
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
    },
    tx,
  );
}
export async function projectScope(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  projectId: string,
  stageId: string | null = null,
  taskId: string | null = null,
) {
  const project = await tx.project.findFirstOrThrow({
    where: { id: projectId, organizationId: ctx.org.id },
  });
  if (stageId)
    await tx.stage.findFirstOrThrow({ where: { id: stageId, projectId } });
  if (taskId)
    await tx.task.findFirstOrThrow({
      where: { id: taskId, projectId, ...(stageId ? { stageId } : {}) },
    });
  return project;
}
export async function siteInProject(
  tx: Prisma.TransactionClient,
  projectId: string,
  siteId: string | null,
) {
  if (siteId)
    await tx.projectSite.findFirstOrThrow({ where: { id: siteId, projectId } });
}
export async function selectedVariant(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  line: { itemId: string; levels: (string | null)[]; uomId: string },
  stockOnly = false,
) {
  const variant = await resolveVariant(
    tx,
    ctx.tenant.id,
    line.itemId,
    line.levels,
  );
  const item = await tx.item.findUniqueOrThrow({
    where: { id: variant.itemId },
    include: { stockUom: true },
  });
  if (stockOnly && !item.stockTracked)
    throw new Error(
      "Only stock-tracked items can be received, consumed or transferred.",
    );
  const uom = await tx.uom.findFirstOrThrow({
    where: {
      id: line.uomId,
      OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
    },
  });
  if (item.stockUom.groupId !== uom.groupId)
    throw new Error("Line unit must match the item's stock UOM group.");
  return { variant, item, uom };
}
export async function lockDocument(
  tx: Prisma.TransactionClient,
  type: string,
  documentId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${type}:${documentId}`}))::text`;
}
