"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { id } from "@/core/schema";
import type { Prisma } from "@/generated/prisma/client";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { billableReceipts } from "./calculations";
import { billOptions } from "./queries";

const searchInput = z.string().trim().max(150);
async function pickerContext(
  org: string,
  permission: "bill.create" | "bill.view",
) {
  const ctx = await requireOrgContext(org);
  if (!(await db.project.count({ where: moduleProjectWhere(ctx, permission) })))
    throw new UserFacingError("You do not have permission to access bills.");
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
  if (!order) throw new UserFacingError("Purchase order is unavailable.");
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
  const search = searchInput.parse(query);
  const parsedOrderId = id.parse(orderId);
  if (editingBillId) id.parse(editingBillId);
  const ctx = await pickerContext(org, "bill.create");
  const order = await db.purchaseOrder.findFirstOrThrow({
    where: {
      id: parsedOrderId,
      organizationId: ctx.org.id,
      project: moduleProjectWhere(ctx, "bill.create"),
      status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] },
    },
    select: { id: true },
  });
  const receiptWhere = {
    AND: [
      { poLine: { orderId: order.id } },
      { receipt: { organizationId: ctx.org.id, status: "APPROVED" } },
      ...(search
        ? [
            {
              OR: [
                {
                  receipt: {
                    code: { contains: search, mode: "insensitive" as const },
                  },
                },
                {
                  poLine: {
                    description: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                },
                {
                  poLine: {
                    variant: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  } satisfies Prisma.GoodsReceiptLineWhereInput;
  const include = {
    receipt: { select: { code: true } },
    poLine: {
      include: {
        variant: true,
        vendorBillLineRows: {
          where: {
            bill: { status: { not: "CANCELLED" } },
            ...(editingBillId ? { billId: { not: editingBillId } } : {}),
          },
          include: { bill: { select: { status: true } } },
        },
        goodsReceiptLineRows: {
          where: { receipt: { status: "APPROVED" } },
          select: { id: true, receivedQty: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    },
  } satisfies Prisma.GoodsReceiptLineInclude;
  const quantitiesByReceipt = new Map<string, string>();
  const seenOrderLines = new Set<string>();
  const options: Option[] = [];
  let cursor: string | undefined;
  while (options.length < 25) {
    const batch = await db.goodsReceiptLine.findMany({
      where: receiptWhere,
      include,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 25,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!batch.length) break;
    for (const candidate of batch) {
      if (seenOrderLines.has(candidate.poLineId)) continue;
      seenOrderLines.add(candidate.poLineId);
      const line = candidate.poLine;
      const billable = billableReceipts(
        line.receivedQty,
        line.vendorBillLineRows.map((bill) => ({
          qty: bill.qty,
          status: bill.bill.status,
          grnLineId: bill.grnLineId,
        })),
        line.goodsReceiptLineRows.map((receipt) => ({
          id: receipt.id,
          receivedQty: receipt.receivedQty,
        })),
      );
      for (const receipt of billable)
        quantitiesByReceipt.set(receipt.grnLineId, receipt.qty);
    }
    for (const line of batch) {
      const qty = quantitiesByReceipt.get(line.id);
      if (qty) {
        options.push({
          value: line.id,
          label: `${line.receipt.code} / ${line.poLine.description || line.poLine.variant.name}`,
          description: `Available: ${qty}`,
        });
        if (options.length === 25) break;
      }
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < 25) break;
  }
  return options;
}
