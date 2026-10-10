import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { OrgContext } from "../context";
import { nextDocumentNumber } from "../numbering";
import {
  domainAudit,
  lockDocument,
  selectedVariant,
} from "../procurement/service";
import {
  calculateInvoiceLine,
  invoiceTotals,
  suggestSalesTaxScope,
  validateStockLine,
} from "./calculations";
import type { invoiceInput } from "./validation";
export async function saveInvoice(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  input: z.output<typeof invoiceInput>,
  originalProjectId?: string | null,
) {
  if (input.id) {
    await lockDocument(tx, "INV", input.id);
    const old = await tx.salesInvoice.findFirstOrThrow({
      where: { id: input.id, organizationId: ctx.org.id },
    });
    if (old.status !== "DRAFT")
      throw new Error("Only draft invoices can be edited.");
    if (old.projectId !== originalProjectId)
      throw new Error("Invoice changed. Reload before editing.");
  }
  const project = input.projectId
    ? await tx.project.findFirstOrThrow({
        where: { id: input.projectId, organizationId: ctx.org.id },
      })
    : null;
  const party = await tx.party.findFirstOrThrow({
    where: {
      id: input.partyId ?? project?.clientPartyId ?? "",
      tenantId: ctx.tenant.id,
      isCustomer: true,
    },
    include: { addresses: { orderBy: { isDefault: "desc" } } },
  });
  const stateId = input.stateId ?? party.addresses[0]?.stateId ?? null;
  if (stateId)
    await tx.state.findFirstOrThrow({
      where: {
        id: stateId,
        ...(ctx.org.countryId ? { countryId: ctx.org.countryId } : {}),
      },
    });
  const scope = suggestSalesTaxScope(ctx.org.stateId, stateId);
  const calculations = [],
    lines = [];
  for (const line of input.lines) {
    const selection = line.itemId
      ? await selectedVariant(tx, ctx, { ...line, itemId: line.itemId })
      : null;
    const uom =
      selection?.uom ??
      (await tx.uom.findFirstOrThrow({
        where: {
          id: line.uomId,
          OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
        },
      }));
    validateStockLine({
      ...line,
      projectId: input.projectId,
      itemVariantId: selection?.variant.id ?? null,
      itemType: selection?.item.type,
      stockTracked: selection?.item.stockTracked,
    });
    if (!selection && !line.description)
      throw new Error("Free-text lines need a description.");
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
      throw new Error("Tax group country differs from organization.");
    if (
      group &&
      scope !== "ANY" &&
      group.scope !== "ANY" &&
      group.scope !== scope
    )
      throw new Error("Tax group conflicts with place of supply.");
    const calculated = calculateInvoiceLine({
      ...line,
      components: group?.components.map((c) => c.component) ?? [],
    });
    calculations.push(calculated);
    lines.push({
      itemVariantId: selection?.variant.id ?? null,
      description: line.description || selection?.variant.name || "",
      qty: line.qty,
      uomId: uom.id,
      rate: line.rate,
      discountPercent: line.discountPercent,
      taxGroupId: group?.id ?? null,
      fromProjectStock: line.fromProjectStock,
      lineSubtotal: calculated.lineSubtotal,
      lineTax: calculated.lineTax,
      lineTotal: calculated.lineTotal,
      taxes: { create: calculated.taxes },
    });
  }
  const dueDate =
    input.dueDate ??
    new Date(input.date.getTime() + party.paymentTerms * 86400000);
  if (dueDate < input.date)
    throw new Error("Due date cannot precede invoice date.");
  const fields = {
    projectId: project?.id ?? null,
    partyId: party.id,
    date: input.date,
    dueDate,
    stateId,
    currency: project?.currency ?? ctx.org.baseCurrency,
    notes: input.notes,
    ...invoiceTotals(calculations),
  };
  if (input.id)
    await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: input.id } });
  const row = input.id
    ? await tx.salesInvoice.update({
        where: { id: input.id },
        data: { ...fields, lines: { create: lines } },
      })
    : await tx.salesInvoice.create({
        data: {
          ...fields,
          organizationId: ctx.org.id,
          code: await nextDocumentNumber(ctx.org.id, "INV", tx),
          createdById: ctx.user.id,
          receivedTotal: "0",
          lines: { create: lines },
        },
      });
  await domainAudit(
    ctx,
    tx,
    "SalesInvoice",
    row.id,
    input.id ? "UPDATE" : "CREATE",
  );
  return row;
}
