"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { billOptions } from "./queries";

const searchInput = z.string().trim().max(150);
async function pickerContext(
  org: string,
  permission: "bill.create" | "bill.view",
) {
  const ctx = await requireOrgContext(org);
  if (!(await db.project.count({ where: moduleProjectWhere(ctx, permission) })))
    throw new Error("You do not have permission to access bills.");
  return ctx;
}
export async function findBillVendors(
  org: string,
  permission: "bill.create" | "bill.view",
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const ctx = await pickerContext(
    org,
    z.enum(["bill.create", "bill.view"]).parse(permission),
  );
  const rows = await db.party.findMany({
    where: {
      tenantId: ctx.tenant.id,
      isVendor: true,
      displayName: { contains: search, mode: "insensitive" },
    },
    orderBy: { displayName: "asc" },
    take: 25,
  });
  return rows.map((v) => ({ value: v.id, label: v.displayName }));
}
export async function findBillTaxGroups(
  org: string,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const ctx = await pickerContext(org, "bill.create");
  const rows = await db.taxGroup.findMany({
    where: {
      tenantId: ctx.tenant.id,
      name: { contains: search, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    take: 25,
  });
  return rows.map((g) => ({ value: g.id, label: g.name }));
}
export async function findBillOrders(
  org: string,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const ctx = await pickerContext(org, "bill.create");
  const rows = await db.purchaseOrder.findMany({
    where: {
      organizationId: ctx.org.id,
      project: moduleProjectWhere(ctx, "bill.create"),
      status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] },
      code: { contains: search, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return rows.map((o) => ({ value: o.id, label: o.code }));
}
export async function getBillOrder(
  org: string,
  editingBillId: string | null,
  orderId: string,
) {
  if (editingBillId) id.parse(editingBillId);
  const data = await billOptions(
    org,
    editingBillId ?? undefined,
    id.parse(orderId),
  );
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Purchase order is unavailable.");
  const ctx = await requireProjectContext(org, order.projectId);
  assertPermission(ctx, "bill.create");
  return { order, vendors: data.vendors, groups: data.groups };
}
export async function findBillReceipts(
  org: string,
  orderId: string,
  editingBillId: string | null,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query).toLocaleLowerCase();
  const { order } = await getBillOrder(org, editingBillId, orderId);
  return order.lines
    .filter(
      (line) =>
        line.grnLineId &&
        `${line.receiptName} ${line.description}`
          .toLocaleLowerCase()
          .includes(search),
    )
    .slice(0, 25)
    .map((line) => ({
      value: line.grnLineId ?? "",
      label: `${line.receiptName} / ${line.description}`,
      description: `Available: ${line.qty}`,
    }));
}
