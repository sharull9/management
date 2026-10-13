import "server-only";
import { parseMultiParam } from "@/components/shared/filter-bar/multi-param";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { listEnabledCurrencies } from "@/modules/currency/server/queries";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { billableReceipts } from "./calculations";
export async function billOptions(
  org: string,
  editingBillId?: string,
  selectedOrderId?: string,
) {
  const ctx = await requireOrgContext(org);
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, "bill.create"),
    orderBy: { name: "asc" },
  });
  const editing = editingBillId
    ? await db.vendorBill.findFirstOrThrow({
        where: {
          id: editingBillId,
          organizationId: ctx.org.id,
          projectId: { in: projects.map((p) => p.id) },
        },
        include: { lines: true },
      })
    : null;
  const orderId = selectedOrderId || editing?.purchaseOrderId;
  const selectedOrder = orderId
    ? await db.purchaseOrder.findFirstOrThrow({
        where: {
          id: orderId,
          organizationId: ctx.org.id,
          projectId: { in: projects.map((p) => p.id) },
        },
        include: { lines: true },
      })
    : null;
  const selectedVendors = [
    editing?.partyId,
    selectedOrder?.vendorPartyId,
  ].filter((id): id is string => !!id);
  const selectedGroups = [
    ...(editing?.lines ?? []),
    ...(selectedOrder?.lines ?? []),
  ].flatMap((l) => (l.taxGroupId ? [l.taxGroupId] : []));
  const [vendors, uoms, groups, variants, orders, currencies] =
    await Promise.all([
      db.party.findMany({
        where: { tenantId: ctx.tenant.id, isVendor: true },
        orderBy: { displayName: "asc" },
        take: 25,
      }),
      db.uom.findMany({
        where: { OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }] },
        orderBy: { name: "asc" },
      }),
      db.taxGroup.findMany({
        where: { tenantId: ctx.tenant.id },
        orderBy: { name: "asc" },
        take: 25,
      }),
      db.itemVariant.findMany({
        where: { item: { tenantId: ctx.tenant.id } },
        orderBy: { name: "asc" },
      }),
      db.purchaseOrder.findMany({
        where: {
          id: orderId ?? "",
          organizationId: ctx.org.id,
          projectId: { in: projects.map((p) => p.id) },
          status: {
            in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"],
          },
        },
        include: {
          lines: {
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
                include: { receipt: { select: { code: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      listEnabledCurrencies(ctx.tenant.id, ctx.org.baseCurrency),
    ]);
  vendors.push(
    ...(await db.party.findMany({
      where: {
        tenantId: ctx.tenant.id,
        isVendor: true,
        id: {
          in: selectedVendors.filter((id) => !vendors.some((v) => v.id === id)),
        },
      },
    })),
  );
  groups.push(
    ...(await db.taxGroup.findMany({
      where: {
        tenantId: ctx.tenant.id,
        id: {
          in: selectedGroups.filter((id) => !groups.some((g) => g.id === id)),
        },
      },
    })),
  );
  return {
    baseCurrency: ctx.org.baseCurrency,
    currencies: currencies.map((c) => ({ code: c.code, name: c.name })),
    projects: projects.map((p) => ({
      id: p.id,
      name: `${p.code} ${p.name}`,
      currency: p.currency,
    })),
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.displayName,
      paymentTerms: v.paymentTerms,
      defaultCurrency: v.defaultCurrency,
    })),
    uoms: uoms.map((u) => ({ id: u.id, name: `${u.code} ${u.name}` })),
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    variants: variants.map((v) => ({ id: v.id, name: v.name })),
    orders: orders.map((o) => ({
      id: o.id,
      name: o.code,
      projectId: o.projectId,
      partyId: o.vendorPartyId,
      currency: o.currency,
      lines: o.lines.flatMap((l) =>
        billableReceipts(
          l.receivedQty,
          l.vendorBillLineRows.map((b) => ({
            qty: b.qty,
            status: b.bill.status,
            grnLineId: b.grnLineId,
          })),
          l.goodsReceiptLineRows,
        ).map((receipt) => ({
          poLineId: l.id,
          grnLineId: receipt.grnLineId,
          receiptName:
            l.goodsReceiptLineRows.find((r) => r.id === receipt.grnLineId)
              ?.receipt.code ?? "Legacy receipt",
          itemVariantId: l.itemVariantId,
          description: l.description || l.variant.name,
          qty: receipt.qty,
          uomId: l.uomId,
          rate: l.rate.toString(),
          discountPercent: l.discountPercent.toString(),
          taxGroupId: l.taxGroupId,
          poRate: l.rate.toString(),
        })),
      ),
    })),
  };
}
export const billStatuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
] as const;
export async function billList(
  org: string,
  filters: {
    projectId?: string;
    partyId?: string;
    status?: string;
    overdue?: string;
  },
) {
  const ctx = await requireOrgContext(org);
  const projects = await db.project.findMany({
    where: moduleProjectWhere(ctx, "bill.view"),
    orderBy: { name: "asc" },
  });
  const projectIds = parseMultiParam(filters.projectId);
  const partyIds = parseMultiParam(filters.partyId);
  const statuses = parseMultiParam(filters.status).filter(
    (s): s is (typeof billStatuses)[number] =>
      billStatuses.some((known) => known === s),
  );
  const rows = await db.vendorBill.findMany({
    where: {
      organizationId: ctx.org.id,
      projectId: {
        in: projects
          .filter((p) => !projectIds.length || projectIds.includes(p.id))
          .map((p) => p.id),
      },
      ...(partyIds.length ? { partyId: { in: partyIds } } : {}),
      ...(statuses.length ? { status: { in: statuses } } : {}),
    },
    include: { project: true, party: true },
    orderBy: { date: "desc" },
  });
  const today = new Date(new Date().toISOString().slice(0, 10));
  const vendors = await db.party.findMany({
    where: { tenantId: ctx.tenant.id, isVendor: true },
    orderBy: { displayName: "asc" },
    take: 25,
  });
  const missingVendors = partyIds.filter(
    (id) => !vendors.some((v) => v.id === id),
  );
  if (missingVendors.length)
    vendors.push(
      ...(await db.party.findMany({
        where: {
          id: { in: missingVendors },
          tenantId: ctx.tenant.id,
          isVendor: true,
        },
      })),
    );
  const writable = await db.project.count({
    where: moduleProjectWhere(ctx, "bill.create"),
  });
  return {
    baseCurrency: ctx.org.baseCurrency,
    projects,
    vendors,
    writable: writable > 0,
    rows:
      filters.overdue === "1"
        ? rows.filter(
            (r) =>
              r.dueDate &&
              r.dueDate < today &&
              r.payableTotal.gt(r.paidTotal) &&
              r.status !== "CANCELLED",
          )
        : rows,
  };
}
export async function billDetail(org: string, billId: string) {
  const row = await db.vendorBill.findFirstOrThrow({
    where: { id: billId, organization: { slug: org } },
    include: {
      project: true,
      party: true,
      purchaseOrder: { include: { goodsReceiptRows: true } },
      lines: {
        include: {
          variant: true,
          uom: true,
          taxes: true,
          grnLine: { include: { receipt: true } },
        },
      },
      allocations: {
        include: { payment: true },
        orderBy: { allocatedAt: "asc" },
      },
    },
  });
  const ctx = await requireProjectContext(org, row.projectId);
  assertPermission(ctx, "bill.view");
  const [attachments, approvals] = await Promise.all([
    db.attachment.findMany({
      where: {
        organizationId: ctx.org.id,
        entityType: "VendorBill",
        entityId: row.id,
      },
    }),
    db.approvalRequest.findMany({
      where: {
        organizationId: ctx.org.id,
        documentType: "VENDOR_BILL",
        documentId: row.id,
      },
      include: {
        steps: { include: { actedBy: true }, orderBy: { sequence: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { ctx, row, attachments, approvals };
}
