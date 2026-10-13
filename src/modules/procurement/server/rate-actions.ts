"use server";

import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";

/** The vendor's default currency, or null when none is set. */
export async function vendorDefaultCurrency(org: string, vendorId: string) {
  const ctx = await requireOrgContext(org);
  const vendor = await db.party.findFirst({
    where: { id: id.parse(vendorId), tenantId: ctx.tenant.id, isVendor: true },
    select: { defaultCurrency: true },
  });
  return vendor?.defaultCurrency ?? null;
}

/** The currency of a purchase order in this organization (inherited by receipts). */
export async function purchaseOrderCurrency(org: string, orderId: string) {
  const ctx = await requireOrgContext(org);
  const order = await db.purchaseOrder.findFirst({
    where: { id: id.parse(orderId), organizationId: ctx.org.id },
    select: { currency: true },
  });
  return order?.currency ?? null;
}
