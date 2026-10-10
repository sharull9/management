import "server-only";
import {
  assertPermission,
  type OrgContext,
  projectAccessWhere,
  requireOrgContext,
  requireProjectContext,
} from "../context";
import { db } from "../db";
import { pickerItems } from "../masters/queries";
import type { DocumentKind } from "./approvals";
import { Decimal, suggestTaxScope } from "./calculations";

export function moduleProjectWhere(ctx: OrgContext, permission: string) {
  const global = ctx.isAdmin || ctx.permissions.has(permission);
  const scopedProject =
    "project" in ctx
      ? (ctx as OrgContext & { project: { id: string } }).project
      : null;
  return {
    organizationId: ctx.org.id,
    ...(scopedProject ? { id: scopedProject.id } : {}),
    AND: [
      projectAccessWhere(ctx),
      ...(global
        ? []
        : [
            {
              OR: [
                { managerUserId: ctx.user.id },
                { members: { some: { userId: ctx.user.id, isManager: true } } },
                {
                  members: {
                    some: {
                      userId: ctx.user.id,
                      role: {
                        tenantId: ctx.tenant.id,
                        permissions: { has: permission },
                      },
                    },
                  },
                },
              ],
            },
          ]),
    ],
  };
}
export async function procurementData(
  org: string,
  projectId?: string,
  inventory = false,
) {
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  const permission = inventory ? "inventory.view" : "purchase.view";
  if (projectId) assertPermission(ctx, permission);
  const projects = await db.project.findMany({
    where: {
      ...moduleProjectWhere(ctx, permission),
      ...(projectId ? { id: projectId } : {}),
    },
    orderBy: { name: "asc" },
  });
  const ids = projects.map((p) => p.id),
    tenantId = ctx.tenant.id;
  const purchaseIds = inventory
    ? (
        await db.project.findMany({
          where: {
            ...moduleProjectWhere(ctx, "purchase.view"),
            id: { in: ids },
          },
          select: { id: true },
        })
      ).map((p) => p.id)
    : ids;
  const [
    items,
    uoms,
    vendors,
    groups,
    sites,
    stages,
    tasks,
    requests,
    orders,
    receipts,
    consumptions,
    transfers,
  ] = await Promise.all([
    pickerItems(tenantId, inventory),
    db.uom.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { name: "asc" },
    }),
    db.party.findMany({
      where: { tenantId, isVendor: true },
      include: { addresses: { where: { isDefault: true }, take: 1 } },
      orderBy: { displayName: "asc" },
    }),
    db.taxGroup.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.projectSite.findMany({ where: { projectId: { in: ids } } }),
    db.stage.findMany({ where: { projectId: { in: ids } } }),
    db.task.findMany({ where: { projectId: { in: ids } } }),
    db.purchaseRequest.findMany({
      where: { organizationId: ctx.org.id, projectId: { in: purchaseIds } },
      include: {
        project: true,
        lines: { include: { variant: true, uom: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.purchaseOrder.findMany({
      where: { organizationId: ctx.org.id, projectId: { in: purchaseIds } },
      include: {
        project: true,
        vendor: true,
        lines: { include: { variant: true, uom: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.goodsReceipt.findMany({
      where: { organizationId: ctx.org.id, projectId: { in: purchaseIds } },
      include: { project: true, order: true },
      orderBy: { createdAt: "desc" },
    }),
    db.materialConsumption.findMany({
      where: { organizationId: ctx.org.id, projectId: { in: ids } },
      include: {
        project: true,
        stage: true,
        task: true,
        lines: { include: { variant: true, uom: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.stockTransfer.findMany({
      where: { organizationId: ctx.org.id, projectId: { in: ids } },
      include: {
        project: true,
        toProject: true,
        lines: { include: { variant: true, uom: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const stock = inventory ? await stockOnHand(ctx, ids) : [];
  return {
    ctx,
    projects,
    items,
    uoms,
    vendors,
    groups,
    sites,
    stages,
    tasks,
    requests,
    orders,
    receipts,
    consumptions,
    transfers,
    stock,
    taxSuggestions: vendors.map((v) => ({
      vendorId: v.id,
      scope: suggestTaxScope(ctx.org.stateId, v.addresses[0]?.stateId ?? null),
    })),
  };
}
export async function stockOnHand(ctx: OrgContext, projectIds: string[]) {
  const rows = await db.stockMovement.groupBy({
    by: ["projectId", "itemVariantId"],
    where: {
      organizationId: ctx.org.id,
      projectId: { in: projectIds },
      project: moduleProjectWhere(ctx, "inventory.view"),
    },
    _sum: { qty: true, totalCost: true },
  });
  const variants = await db.itemVariant.findMany({
    where: {
      id: { in: rows.map((r) => r.itemVariantId) },
      item: { tenantId: ctx.tenant.id },
    },
    include: { item: { include: { stockUom: true } } },
  });
  return rows.map((r) => {
    const variant = variants.find((v) => v.id === r.itemVariantId);
    const qty = new Decimal(r._sum.qty ?? 0),
      value = new Decimal(r._sum.totalCost ?? 0);
    return {
      projectId: r.projectId,
      variantId: r.itemVariantId,
      name: variant?.name || variant?.item.name || "",
      uom: variant?.item.stockUom.code ?? "",
      qty: qty.toString(),
      value: value.toFixed(2),
      avgCost: qty.gt(0) ? value.div(qty).toFixed(4) : "0.0000",
    };
  });
}
export async function documentDetail(
  org: string,
  kind: DocumentKind,
  documentId: string,
) {
  const orgCtx = await requireOrgContext(org);
  const where = { id: documentId, organizationId: orgCtx.org.id };
  const row =
    kind === "requests"
      ? await db.purchaseRequest.findFirstOrThrow({
          where,
          include: {
            project: true,
            lines: { include: { variant: true, uom: true } },
            requestedBy: true,
          },
        })
      : kind === "orders"
        ? await db.purchaseOrder.findFirstOrThrow({
            where,
            include: {
              project: true,
              vendor: true,
              site: true,
              lines: {
                include: {
                  variant: true,
                  uom: true,
                  taxes: true,
                  prLine: { include: { request: true } },
                },
              },
            },
          })
        : kind === "receipts"
          ? await db.goodsReceipt.findFirstOrThrow({
              where,
              include: {
                project: true,
                order: true,
                site: true,
                receivedBy: true,
                lines: {
                  include: {
                    uom: true,
                    poLine: { include: { variant: true } },
                  },
                },
              },
            })
          : await db.stockTransfer.findFirstOrThrow({
              where,
              include: {
                project: true,
                toProject: true,
                lines: { include: { variant: true, uom: true } },
              },
            });
  const ctx = await requireProjectContext(org, row.projectId);
  assertPermission(
    ctx,
    kind === "transfers" ? "inventory.view" : "purchase.view",
  );
  const approvals = await db.approvalRequest.findMany({
    where: { organizationId: ctx.org.id, documentId: row.id },
    include: {
      steps: { include: { actedBy: true }, orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const attachments =
    kind === "orders"
      ? await db.attachment.findMany({
          where: {
            organizationId: ctx.org.id,
            entityType: "PurchaseOrder",
            entityId: row.id,
          },
        })
      : [];
  return { ctx, row, approvals, attachments };
}
