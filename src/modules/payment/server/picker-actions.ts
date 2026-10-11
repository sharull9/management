"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { settledStatuses } from "./allocation";

const permissionInput = z.enum([
  "payment.record",
  "payment.request.create",
  "payment.view",
  "sales.view",
]);
const searchInput = z.string().trim().max(150);
async function pickerScope(
  org: string,
  permission: string,
  projectId?: string | null,
) {
  const checked = permissionInput.parse(permission);
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  if (projectId) assertPermission(ctx, checked);
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, checked),
    select: { id: true },
  });
  const global = ctx.isAdmin || ctx.permissions.has(checked);
  if (!global && !projects.length) assertPermission(ctx, checked);
  const ids = projects.map((p) => p.id);
  if (projectId && !ids.includes(projectId))
    throw new Error("Project is not accessible.");
  return {
    ctx,
    projects: moduleProjectWhere(ctx, checked),
    bills: { organizationId: ctx.org.id, projectId: projectId ?? { in: ids } },
    documents: {
      organizationId: ctx.org.id,
      ...(projectId
        ? { projectId }
        : {
            OR: [
              ...(global ? [{ projectId: null }] : []),
              { projectId: { in: ids } },
            ],
          }),
    },
  };
}
export async function findParties(
  org: string,
  permission: string,
  direction: string,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const side = z.enum(["OUTGOING", "INCOMING"]).parse(direction);
  const { ctx } = await pickerScope(org, permission);
  const rows = await db.party.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(side === "OUTGOING" ? { isVendor: true } : { isCustomer: true }),
      displayName: { contains: search, mode: "insensitive" as const },
    },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
    take: 50,
  });
  return rows.map((p) => ({ value: p.id, label: p.displayName }));
}
export async function findProjects(
  org: string,
  permission: string,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const scope = await pickerScope(org, permission);
  const rows = await db.project.findMany({
    where: {
      AND: [
        scope.projects,
        {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        },
      ],
    },
    select: { id: true, code: true, name: true, currency: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return rows.map((p) => ({
    value: p.id,
    label: `${p.code} | ${p.name}`,
    description: p.currency,
  }));
}
export async function findOpenDocuments(
  org: string,
  permission: string,
  direction: string,
  partyId: string,
  projectId: string | null,
  currency: string,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const side = z.enum(["OUTGOING", "INCOMING"]).parse(direction);
  z.string().max(100).parse(partyId);
  z.string().max(100).nullable().parse(projectId);
  z.string().max(10).parse(currency);
  const scope = await pickerScope(org, permission, projectId);
  if (partyId)
    await db.party.findFirstOrThrow({
      where: {
        id: partyId,
        tenantId: scope.ctx.tenant.id,
        ...(side === "OUTGOING" ? { isVendor: true } : { isCustomer: true }),
      },
      select: { id: true },
    });
  const where = {
    partyId,
    currency,
    status: { in: [...settledStatuses] },
    code: { contains: search, mode: "insensitive" as const },
  };
  const rows =
    side === "OUTGOING"
      ? await db.vendorBill
          .findMany({
            where: {
              ...scope.bills,
              ...where,
              payableTotal: { gt: db.vendorBill.fields.paidTotal },
            },
            select: {
              id: true,
              code: true,
              currency: true,
              payableTotal: true,
              paidTotal: true,
            },
            orderBy: { date: "asc" },
            take: 50,
          })
          .then((rows) =>
            rows.map((b) => ({
              ...b,
              outstanding: b.payableTotal.sub(b.paidTotal).toFixed(2),
            })),
          )
      : await db.salesInvoice
          .findMany({
            where: {
              ...scope.documents,
              ...where,
              payableTotal: { gt: db.salesInvoice.fields.receivedTotal },
            },
            select: {
              id: true,
              code: true,
              currency: true,
              payableTotal: true,
              receivedTotal: true,
            },
            orderBy: { date: "asc" },
            take: 50,
          })
          .then((rows) =>
            rows.map((b) => ({
              ...b,
              outstanding: b.payableTotal.sub(b.receivedTotal).toFixed(2),
            })),
          );
  return rows.map((b) => ({
    value: b.id,
    label: b.code,
    description: `${b.currency} ${b.outstanding} outstanding`,
  }));
}
