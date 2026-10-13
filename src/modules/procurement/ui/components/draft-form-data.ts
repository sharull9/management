import type { documentDetail } from "../../server/queries";
import type { DraftLine, ProcurementFormData } from "../../type";
import { selectedLevels } from "../../util";

type Row = Awaited<ReturnType<typeof documentDetail>>["row"];

/** Form defaults for editing an existing draft document (server-only data). */
export function draftFormValues(row: Row) {
  const initial: Record<string, string> = {};
  let initialLines: DraftLine[] = [];
  if ("estimatedTotal" in row) {
    initial.stageId = row.stageId ?? "";
    initial.taskId = row.taskId ?? "";
    initial.neededBy = row.neededBy?.toISOString().slice(0, 10) ?? "";
    initialLines = row.lines.map((l) => ({
      itemId: l.variant.itemId,
      levels: selectedLevels(l.variant),
      qty: l.qty.toString(),
      uomId: l.uomId,
      description: l.description,
      estimatedRate: l.estimatedRate.toString(),
    }));
  } else if ("grandTotal" in row) {
    Object.assign(initial, {
      vendorPartyId: row.vendorPartyId,
      siteId: row.siteId ?? "",
      date: row.date.toISOString().slice(0, 10),
      paymentTerms: row.paymentTerms,
      paymentDays: String(row.paymentDays),
      currency: row.currency,
      exchangeRate: row.exchangeRate.toString(),
      receiptTolerancePercent: row.receiptTolerancePercent.toString(),
    });
    initialLines = row.lines.map((l) => ({
      itemId: l.variant.itemId,
      levels: selectedLevels(l.variant),
      qty: l.qty.toString(),
      uomId: l.uomId,
      description: l.description,
      rate: l.rate.toString(),
      discountPercent: l.discountPercent.toString(),
      taxGroupId: l.taxGroupId,
      prLineId: l.prLineId,
    }));
  } else if ("poId" in row) {
    Object.assign(initial, {
      poId: row.poId,
      currency: row.currency,
      exchangeRate: row.exchangeRate.toString(),
      siteId: row.siteId ?? "",
      receivedDate: row.receivedDate.toISOString().slice(0, 10),
      challanNumber: row.challanNumber ?? "",
      vehicleNumber: row.vehicleNumber ?? "",
    });
    initialLines = row.lines.map((l) => ({
      itemId: l.poLine.variant.itemId,
      levels: selectedLevels(l.poLine.variant),
      qty: "1",
      uomId: l.uomId,
      poLineId: l.poLineId,
      receivedQty: l.receivedQty.toString(),
      acceptedQty: l.acceptedQty.toString(),
      rejectedQty: l.rejectedQty.toString(),
      remarks: l.remarks ?? "",
    }));
  } else {
    Object.assign(initial, {
      toProjectId: row.toProjectId,
      date: row.date.toISOString().slice(0, 10),
    });
    initialLines = row.lines.map((l) => ({
      itemId: l.variant.itemId,
      levels: selectedLevels(l.variant),
      qty: l.qty.toString(),
      uomId: l.uomId,
    }));
  }
  return { initial, initialLines };
}

/** A receipt's own purchase order may no longer be pickable; keep it selectable. */
export function withReceiptOrder(inputs: ProcurementFormData, row: Row) {
  if (!("poId" in row) || inputs.orders.some((o) => o.id === row.poId))
    return inputs;
  inputs.orders.push({
    id: row.poId,
    name: row.order.code,
    projectId: row.projectId,
    currency: row.currency,
    lines: row.lines.map((l) => ({
      id: l.poLineId,
      name: l.poLine.variant.name,
      itemId: l.poLine.variant.itemId,
      item: {
        itemId: l.poLine.variant.itemId,
        level1: l.poLine.variant.level1Id,
        level2: l.poLine.variant.level2Id,
        level3: l.poLine.variant.level3Id,
        level4: l.poLine.variant.level4Id,
        level5: l.poLine.variant.level5Id,
      },
      uomId: l.uomId,
      pending: "0",
    })),
  });
  return inputs;
}
