import { Decimal } from "@/core/decimal";
import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { resolveDocumentFx } from "@/modules/currency/server/rates";
import { assertDocumentCurrency } from "@/modules/procurement/server/currency";
import {
  domainAudit,
  lockDocument,
  projectScope,
} from "@/modules/procurement/server/service";
import { suggestTaxScope } from "@/modules/tax/util";
import type { billInput } from "../schema";
import {
  assertBillCurrency,
  billableQty,
  billBaseTotals,
  billTotals,
  billVarianceBase,
  calculateBillLine,
  matchedReceiptRate,
} from "./calculations";
export async function assertBillReceipts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  billId: string,
  purchaseOrderId: string | null,
  lines: {
    poLineId: string | null;
    grnLineId: string | null;
    qty: Prisma.Decimal | string;
  }[],
) {
  if (!purchaseOrderId) return;
  await lockDocument(tx, "PO", purchaseOrderId);
  const po = await tx.purchaseOrder.findFirstOrThrow({
    where: {
      id: purchaseOrderId,
      organizationId,
      status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] },
    },
  });
  const quantities = new Map<string, InstanceType<typeof Decimal>>();
  const grnQuantities = new Map<string, InstanceType<typeof Decimal>>();
  for (const line of lines) {
    if (!line.poLineId)
      throw new Error("Every PO bill line must reference a PO line.");
    quantities.set(
      line.poLineId,
      (quantities.get(line.poLineId) ?? new Decimal(0)).add(line.qty),
    );
    if (line.grnLineId)
      grnQuantities.set(
        line.grnLineId,
        (grnQuantities.get(line.grnLineId) ?? new Decimal(0)).add(line.qty),
      );
  }
  for (const [poLineId, qty] of quantities) {
    const line = await tx.purchaseOrderLine.findFirstOrThrow({
      where: { id: poLineId, orderId: po.id },
    });
    const other = await tx.vendorBillLine.findMany({
      where: {
        poLineId,
        billId: { not: billId },
        bill: { status: { not: "CANCELLED" } },
      },
      include: { bill: { select: { status: true } } },
    });
    if (
      qty.gt(
        billableQty(
          line.receivedQty,
          other.map((l) => ({ qty: l.qty, status: l.bill.status })),
        ),
      )
    )
      throw new Error("Bill quantity exceeds received-but-unbilled quantity.");
  }
  for (const [grnLineId, qty] of grnQuantities) {
    const grn = await tx.goodsReceiptLine.findFirstOrThrow({
      where: {
        id: grnLineId,
        receipt: { poId: po.id, organizationId, status: "APPROVED" },
      },
    });
    const other = await tx.vendorBillLine.findMany({
      where: {
        grnLineId,
        billId: { not: billId },
        bill: { status: { not: "CANCELLED" } },
      },
      include: { bill: { select: { status: true } } },
    });
    if (
      qty.gt(
        billableQty(
          grn.receivedQty,
          other.map((l) => ({ qty: l.qty, status: l.bill.status })),
        ),
      )
    )
      throw new Error(
        "Bill quantity exceeds the linked GRN's unbilled quantity.",
      );
  }
}
export async function saveBill(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof billInput>,
) {
  const project = await projectScope(tx, ctx, input.projectId);
  if (input.id) {
    await lockDocument(tx, "BILL", input.id);
    const old = await tx.vendorBill.findFirstOrThrow({
      where: {
        id: input.id,
        organizationId: ctx.org.id,
        projectId: input.projectId,
      },
    });
    if (old.status !== "DRAFT") throw new Error("Only drafts can be edited.");
  }
  const vendor = await tx.party.findFirstOrThrow({
    where: { id: input.partyId, tenantId: ctx.tenant.id, isVendor: true },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
  });
  await lockDocument(tx, "BILL_INVOICE", `${ctx.org.id}:${vendor.id}`);
  if (
    await tx.vendorBill.findFirst({
      where: {
        organizationId: ctx.org.id,
        partyId: vendor.id,
        vendorInvoiceNo: { equals: input.vendorInvoiceNo, mode: "insensitive" },
        status: { not: "CANCELLED" },
        ...(input.id ? { id: { not: input.id } } : {}),
      },
    })
  )
    throw new Error("This vendor invoice number is already billed.");
  const order = input.purchaseOrderId
    ? await tx.purchaseOrder.findFirstOrThrow({
        where: {
          id: input.purchaseOrderId,
          organizationId: ctx.org.id,
          projectId: project.id,
          vendorPartyId: vendor.id,
          status: {
            in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"],
          },
        },
        include: { lines: true },
      })
    : null;
  // A linked PO fixes the bill currency; otherwise vendor default, else base.
  const currency =
    order?.currency ??
    input.currency ??
    vendor.defaultCurrency ??
    ctx.org.baseCurrency;
  assertBillCurrency({
    requested: input.currency,
    orderCurrency: order?.currency ?? null,
  });
  await assertDocumentCurrency(tx, ctx.tenant.id, ctx.org.id, currency);
  const fx = await resolveDocumentFx(tx, {
    organizationId: ctx.org.id,
    currency,
    date: input.date,
    override: input.exchangeRate,
  });
  await assertBillReceipts(
    tx,
    ctx.org.id,
    input.id ?? "",
    input.purchaseOrderId,
    input.lines,
  );
  const approvedReceiptLines = order
    ? await tx.goodsReceiptLine.findMany({
        where: {
          poLineId: { in: order.lines.map((l) => l.id) },
          receipt: { status: "APPROVED", poId: order.id },
        },
        include: { receipt: { select: { exchangeRate: true } } },
      })
    : [];
  const calculated = [],
    lines = [];
  for (const line of input.lines) {
    const poLine = order?.lines.find((l) => l.id === line.poLineId);
    if (order && !poLine) throw new Error("Invalid PO line.");
    if (!order && (line.poLineId || line.grnLineId))
      throw new Error("Direct bills cannot reference PO/GRN lines.");
    if (
      poLine &&
      (line.uomId !== poLine.uomId ||
        (line.itemVariantId && line.itemVariantId !== poLine.itemVariantId))
    )
      throw new Error("PO bill item and unit must match the PO line.");
    const grnLine = line.grnLineId
      ? await tx.goodsReceiptLine.findFirstOrThrow({
          where: {
            id: line.grnLineId,
            poLineId: line.poLineId ?? "",
            uomId: line.uomId,
            receipt: {
              status: "APPROVED",
              poId: order?.id,
              organizationId: ctx.org.id,
            },
          },
          include: {
            receipt: { select: { currency: true, exchangeRate: true } },
          },
        })
      : null;
    if (grnLine)
      assertBillCurrency({
        requested: currency,
        orderCurrency: null,
        receiptCurrency: grnLine.receipt.currency,
      });
    const uom = await tx.uom.findFirstOrThrow({
      where: {
        id: line.uomId,
        OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
      },
    });
    if (line.itemVariantId && !poLine) {
      const variant = await tx.itemVariant.findFirstOrThrow({
        where: { id: line.itemVariantId, item: { tenantId: ctx.tenant.id } },
        include: { item: { include: { stockUom: true } } },
      });
      if (variant.item.stockUom.groupId !== uom.groupId)
        throw new Error("Item and unit groups differ.");
    }
    const group = line.taxGroupId
      ? await tx.taxGroup.findFirstOrThrow({
          where: { id: line.taxGroupId, tenantId: ctx.tenant.id },
          include: {
            components: {
              include: { component: true },
              orderBy: { sequence: "asc" },
            },
          },
        })
      : null;
    const scope = suggestTaxScope(
      ctx.org.stateId,
      vendor.addresses[0]?.stateId ?? null,
    );
    if (
      group?.countryId &&
      ctx.org.countryId &&
      group.countryId !== ctx.org.countryId
    )
      throw new Error("Tax group country differs from the organization.");
    if (
      group &&
      group.scope !== "ANY" &&
      scope !== "ANY" &&
      group.scope !== scope
    )
      throw new Error(
        "Tax group scope differs from organization and vendor states.",
      );
    const calc = calculateBillLine(
      line,
      group?.components.map((c) => c.component) ?? [],
    );
    calculated.push(calc);
    lines.push({
      ...line,
      itemVariantId: poLine?.itemVariantId ?? line.itemVariantId,
      poRate: poLine?.rate ?? null,
      // Base-currency price variance against the matched receipt (includes FX
      // between the receipt rate and this bill's rate).
      varianceAmount: billVarianceBase({
        qty: line.qty,
        rate: line.rate,
        discountPercent: line.discountPercent,
        poNetRate: poLine?.netRate ?? null,
        billRate: fx.exchangeRate,
        receiptRate: grnLine
          ? grnLine.receipt.exchangeRate
          : matchedReceiptRate(
              approvedReceiptLines
                .filter((r) => r.poLineId === poLine?.id)
                .map((r) => ({
                  qty: r.acceptedQty,
                  rate: r.receipt.exchangeRate,
                })),
              order?.exchangeRate ?? "1",
            ),
        baseDecimals: fx.baseDecimals,
      }),
      lineSubtotal: calc.lineSubtotal,
      lineTax: calc.lineTax,
      lineTotal: calc.lineTotal,
      taxes: { create: calc.taxes },
    });
  }
  if (input.id) {
    await tx.vendorBillLineTax.deleteMany({
      where: { line: { billId: input.id } },
    });
    await tx.vendorBillLine.deleteMany({ where: { billId: input.id } });
  }
  const totals = billTotals(calculated);
  const dueDate =
    input.dueDate ??
    new Date(input.date.getTime() + vendor.paymentTerms * 86400000);
  const fields = {
    projectId: project.id,
    partyId: vendor.id,
    purchaseOrderId: order?.id ?? null,
    date: input.date,
    vendorInvoiceNo: input.vendorInvoiceNo,
    vendorInvoiceDate: input.vendorInvoiceDate,
    dueDate,
    notes: input.notes,
    currency,
    exchangeRate: fx.exchangeRate,
    ...totals,
    ...billBaseTotals(totals, fx.toBase),
    lines: { create: lines },
  };
  const row = input.id
    ? await tx.vendorBill.update({ where: { id: input.id }, data: fields })
    : await tx.vendorBill.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "BILL", tx),
          createdById: ctx.user.id,
          paidTotal: "0",
        },
      });
  await domainAudit(
    ctx,
    tx,
    "VendorBill",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
