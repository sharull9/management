import "server-only";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { pickerItems } from "@/modules/masters/server/queries";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
export async function salesData(
  org: string,
  projectId?: string,
  permission = "sales.view",
) {
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  if (projectId) assertPermission(ctx, permission);
  const global = ctx.isAdmin || ctx.permissions.has(permission);
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, permission),
    orderBy: { name: "asc" },
  });
  const where = {
    organizationId: ctx.org.id,
    OR: [
      { projectId: { in: projects.map((p) => p.id) } },
      ...(global && !projectId ? [{ projectId: null }] : []),
    ],
  };
  const [invoices, customers, items, uoms, groups, states] = await Promise.all([
    db.salesInvoice.findMany({
      where,
      include: { party: true, project: true },
      orderBy: { date: "desc" },
    }),
    db.party.findMany({
      where: { tenantId: ctx.tenant.id, isCustomer: true },
      include: { addresses: { orderBy: { isDefault: "desc" } } },
      orderBy: { displayName: "asc" },
    }),
    pickerItems(ctx.tenant.id),
    db.uom.findMany({
      where: { OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }] },
      orderBy: { name: "asc" },
    }),
    db.taxGroup.findMany({
      where: { tenantId: ctx.tenant.id },
      include: {
        components: {
          include: { component: true },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.state.findMany({
      where: ctx.org.countryId ? { countryId: ctx.org.countryId } : {},
      orderBy: { name: "asc" },
    }),
  ]);
  return { ctx, projects, invoices, customers, items, uoms, groups, states };
}
export async function invoiceDetail(org: string, invoiceId: string) {
  const orgCtx = await requireOrgContext(org);
  const row = await db.salesInvoice.findFirstOrThrow({
    where: { id: invoiceId, organizationId: orgCtx.org.id },
    include: {
      party: {
        include: {
          addresses: {
            include: { city: true, state: true, country: true },
            orderBy: { isDefault: "desc" },
          },
          taxIdentifiers: true,
        },
      },
      placeOfSupply: true,
      project: true,
      lines: { include: { variant: true, uom: true, taxes: true } },
      allocations: {
        where: {
          payment: {
            organizationId: orgCtx.org.id,
            direction: "INCOMING",
            status: "POSTED",
          },
        },
        include: { payment: true },
        orderBy: { allocatedAt: "asc" },
      },
    },
  });
  const ctx = row.projectId
    ? await requireProjectContext(org, row.projectId)
    : orgCtx;
  assertPermission(ctx, "sales.view");
  const [approvals, taxIdentifiers] = await Promise.all([
    db.approvalRequest.findMany({
      where: {
        organizationId: ctx.org.id,
        documentType: "SALES_INVOICE",
        documentId: row.id,
      },
      include: {
        steps: { include: { actedBy: true }, orderBy: { sequence: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.taxIdentifier.findMany({ where: { organizationId: ctx.org.id } }),
  ]);
  return { ctx, row, approvals, taxIdentifiers };
}
