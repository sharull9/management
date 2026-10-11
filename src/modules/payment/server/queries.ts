import "server-only";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { settledStatuses } from "./allocation";

export async function financeData(
  org: string,
  permission = "payment.view",
  projectId?: string,
) {
  const orgCtx = await requireOrgContext(org);
  const ctx = projectId ? await requireProjectContext(org, projectId) : orgCtx;
  const canViewOrg = orgCtx.isAdmin || orgCtx.permissions.has(permission);
  const global = ctx.isAdmin || ctx.permissions.has(permission);
  if (projectId) assertPermission(ctx, permission);
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, permission),
    orderBy: { name: "asc" },
  });
  const ids = projects.map((p) => p.id);
  if (!global && !ids.length) assertPermission(ctx, permission);
  if (projectId && !ids.includes(projectId))
    throw new Error("Project is not accessible.");
  const where = {
    organizationId: ctx.org.id,
    ...(projectId
      ? { projectId }
      : {
          OR: [
            ...(global ? [{ projectId: null }] : []),
            { projectId: { in: ids } },
          ],
        }),
  };
  const [parties, requests, payments, bills, invoices] = await Promise.all([
    db.party.findMany({
      where: {
        tenantId: ctx.tenant.id,
        OR: [{ isVendor: true }, { isCustomer: true }],
      },
      orderBy: { displayName: "asc" },
    }),
    db.paymentRequest.findMany({
      where,
      include: {
        party: true,
        bills: true,
        payments: { where: { status: "POSTED" } },
      },
      orderBy: { date: "desc" },
    }),
    db.payment.findMany({
      where: projectId
        ? {
            organizationId: ctx.org.id,
            OR: [
              { projectId },
              {
                allocations: {
                  some: {
                    OR: [
                      { vendorBill: { projectId } },
                      { salesInvoice: { projectId } },
                    ],
                  },
                },
              },
            ],
          }
        : !canViewOrg
          ? {
              organizationId: ctx.org.id,
              OR: [
                { projectId: { in: ids } },
                {
                  allocations: {
                    some: {
                      OR: [
                        { vendorBill: { projectId: { in: ids } } },
                        { salesInvoice: { projectId: { in: ids } } },
                      ],
                    },
                  },
                },
              ],
            }
          : where,
      include: {
        party: true,
        allocations: { include: { vendorBill: true, salesInvoice: true } },
      },
      orderBy: { date: "desc" },
    }),
    db.vendorBill.findMany({
      where: {
        organizationId: ctx.org.id,
        projectId: projectId ?? { in: ids },
        status: { in: [...settledStatuses] },
      },
      orderBy: { date: "asc" },
    }),
    db.salesInvoice.findMany({
      where: { ...where, status: { in: [...settledStatuses] } },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    ctx,
    projects,
    parties,
    requests,
    payments,
    bills,
    invoices,
    projectId,
    allowOrganization: global && !("project" in ctx),
    canViewOrg,
  };
}
export type FinanceData = Awaited<ReturnType<typeof financeData>>;
