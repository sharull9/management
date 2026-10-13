import { Decimal, money } from "@/core/decimal";
import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { assertEnabledCurrency } from "@/modules/currency/server/enabled";
import { resolveDocumentFx } from "@/modules/currency/server/rates";
import { calculateTax, suggestTaxScope } from "@/modules/tax/util";
import { convertUom } from "@/modules/uom/util";
import type { orderInput } from "../schema";

import {
  domainAudit,
  lockDocument,
  projectScope,
  selectedVariant,
  siteInProject,
} from "./service";
export async function savePurchaseOrder(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof orderInput>,
) {
  const project = await projectScope(tx, ctx, input.projectId);
  await siteInProject(tx, input.projectId, input.siteId);
  await assertEnabledCurrency(
    tx,
    ctx.tenant.id,
    input.currency,
    ctx.org.baseCurrency,
  );
  const vendor = await tx.party.findFirstOrThrow({
    where: { id: input.vendorPartyId, tenantId: ctx.tenant.id, isVendor: true },
    include: { addresses: { where: { isDefault: true }, take: 1 } },
  });
  if (input.id) {
    await lockDocument(tx, "PO", input.id);
    const old = await tx.purchaseOrder.findFirstOrThrow({
      where: {
        id: input.id,
        organizationId: ctx.org.id,
        projectId: input.projectId,
      },
    });
    if (old.status !== "DRAFT") throw new Error("Only drafts can be edited.");
  }
  const linkedIds = input.lines
    .flatMap((l) => (l.prLineId ? [l.prLineId] : []))
    .sort();
  if (new Set(linkedIds).size !== linkedIds.length)
    throw new Error("Combine quantities for the same PR line.");
  for (const prLineId of linkedIds) await lockDocument(tx, "PR_LINE", prLineId);
  const lines = [];
  for (const line of input.lines) {
    const { variant, item, uom } = await selectedVariant(tx, ctx, line);
    if (line.prLineId) {
      const pr = await tx.purchaseRequestLine.findFirstOrThrow({
        where: {
          id: line.prLineId,
          request: {
            projectId: project.id,
            organizationId: ctx.org.id,
            status: "APPROVED",
          },
          itemVariantId: variant.id,
        },
        include: { uom: true },
      });
      const existing = await tx.purchaseOrderLine.findMany({
        where: {
          prLineId: pr.id,
          order: { status: { not: "CANCELLED" } },
          ...(input.id ? { orderId: { not: input.id } } : {}),
        },
        include: { uom: true },
      });
      const previously = existing.reduce(
        (a, l) => a.add(convertUom(l.qty, l.uom, pr.uom)),
        new Decimal(0),
      );
      if (previously.add(convertUom(line.qty, uom, pr.uom)).gt(pr.qty))
        throw new Error("Ordered quantity exceeds the approved PR quantity.");
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
    if (
      group?.countryId &&
      ctx.org.countryId &&
      group.countryId !== ctx.org.countryId
    )
      throw new Error("Tax group country differs from the organization.");
    const suggestedScope = suggestTaxScope(
      ctx.org.stateId,
      vendor.addresses[0]?.stateId ?? null,
    );
    if (
      group &&
      group.scope !== "ANY" &&
      suggestedScope !== "ANY" &&
      group.scope !== suggestedScope
    )
      throw new Error(
        "Tax group scope differs from the organization and vendor states.",
      );
    const netRate = new Decimal(line.rate).mul(
      new Decimal(1).sub(new Decimal(line.discountPercent).div(100)),
    );
    const netAmount = money(new Decimal(line.qty).mul(netRate));
    const taxes = calculateTax(
      netAmount,
      group?.components.map((c) => c.component) ?? [],
    );
    const stockFactor = new Decimal(uom.factor).div(item.stockUom.factor);
    if (!stockFactor.eq(stockFactor.toDecimalPlaces(8)))
      throw new Error("UOM conversion factor exceeds snapshot precision.");
    lines.push({
      itemVariantId: variant.id,
      description: line.description || variant.name,
      qty: line.qty,
      uomId: uom.id,
      rate: line.rate,
      discountPercent: line.discountPercent,
      netRate: netRate.toDecimalPlaces(8),
      netAmount,
      prLineId: line.prLineId,
      taxGroupId: line.taxGroupId,
      stockFactor,
      stockUomId: item.stockUomId,
      taxes: { create: taxes.lines },
    });
  }
  const subtotal = lines.reduce((a, l) => a.add(l.netAmount), new Decimal(0));
  const taxTotal = lines
    .flatMap((l) => l.taxes.create)
    .filter((l) => !l.isWithholding)
    .reduce((a, l) => a.add(l.amount), new Decimal(0));
  const withholdingTotal = lines
    .flatMap((l) => l.taxes.create)
    .filter((l) => l.isWithholding)
    .reduce((a, l) => a.add(l.amount), new Decimal(0));
  if (input.id) {
    await tx.purchaseOrderLineTax.deleteMany({
      where: { line: { orderId: input.id } },
    });
    await tx.purchaseOrderLine.deleteMany({ where: { orderId: input.id } });
  }
  // Totals are computed in the document currency, then converted once each at
  // the rate the user confirmed (never from client-supplied base numbers).
  const fx = await resolveDocumentFx(tx, {
    organizationId: ctx.org.id,
    currency: input.currency,
    date: input.date,
    override: input.exchangeRate,
  });
  const grandTotal = subtotal.add(taxTotal).sub(withholdingTotal);
  const fields = {
    projectId: project.id,
    vendorPartyId: vendor.id,
    date: input.date,
    siteId: input.siteId,
    paymentTerms: input.paymentTerms,
    paymentDays: input.paymentDays,
    currency: input.currency,
    exchangeRate: fx.exchangeRate,
    receiptTolerancePercent: input.receiptTolerancePercent,
    subtotal,
    taxTotal,
    withholdingTotal,
    grandTotal,
    baseSubtotal: fx.toBase(subtotal),
    baseTaxTotal: fx.toBase(taxTotal),
    baseWithholdingTotal: fx.toBase(withholdingTotal),
    baseGrandTotal: fx.toBase(grandTotal),
  };
  const row = input.id
    ? await tx.purchaseOrder.update({
        where: { id: input.id },
        data: { ...fields, lines: { create: lines } },
      })
    : await tx.purchaseOrder.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "PO", tx),
          createdById: ctx.user.id,
          lines: { create: lines },
        },
      });
  await domainAudit(
    ctx,
    tx,
    "PurchaseOrder",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
