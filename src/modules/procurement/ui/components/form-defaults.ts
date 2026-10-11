import type { z } from "zod";
import type { formLine } from "../../schema";
import type { DraftLine } from "../../type";

export function lineDefaults(line?: DraftLine): z.input<typeof formLine> {
  return {
    item: {
      itemId: line?.itemId || null,
      level1: line?.levels[0] ?? null,
      level2: line?.levels[1] ?? null,
      level3: line?.levels[2] ?? null,
      level4: line?.levels[3] ?? null,
      level5: line?.levels[4] ?? null,
    },
    qty: Number(line?.qty ?? 1),
    uomId: line?.uomId || null,
    description: line?.description ?? "",
    estimatedRate: Number(line?.estimatedRate ?? 0),
    rate: Number(line?.rate ?? 0),
    discountPercent: Number(line?.discountPercent ?? 0),
    taxGroupId: line?.taxGroupId ?? null,
    prLineId: line?.prLineId ?? null,
    poLineId: line?.poLineId ?? null,
    receivedQty: Number(line?.receivedQty ?? 1),
    acceptedQty: Number(line?.acceptedQty ?? 1),
    rejectedQty: Number(line?.rejectedQty ?? 0),
    remarks: line?.remarks ?? "",
  };
}
