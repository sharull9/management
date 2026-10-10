import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { decimal, id, name } from "../schema";
import type { MasterKind } from "../type";
import { flag, val } from "./form-data";
export async function saveUomMaster(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: MasterKind,
  rowId: string | null,
  data: FormData,
) {
  let entityId = rowId ?? "";
  switch (kind) {
    case "uomGroup": {
      if (rowId)
        await tx.uomGroup.findFirstOrThrow({
          where: { id: rowId, tenantId },
        });
      const fields = { name: name.parse(val(data, "name")) };
      const row = rowId
        ? await tx.uomGroup.update({ where: { id: rowId }, data: fields })
        : await tx.uomGroup.create({
            data: {
              ...fields,
              tenantId,
              key: `${tenantId}:${name.parse(val(data, "key"))}`,
              uoms: {
                create: {
                  tenantId,
                  code: name.parse(val(data, "baseCode")),
                  name: name.parse(val(data, "baseName")),
                  factor: "1",
                  isBase: true,
                },
              },
            },
          });
      entityId = row.id;
      break;
    }
    case "uom": {
      const groupId = id.parse(val(data, "groupId"));
      const group = await tx.uomGroup.findFirstOrThrow({
        where: { id: groupId, OR: [{ tenantId }, { tenantId: null }] },
      });
      const old = rowId
        ? await tx.uom.findFirstOrThrow({
            where: { id: rowId, tenantId },
          })
        : null;
      const factor = new Prisma.Decimal(decimal.parse(val(data, "factor")));
      const isBase = flag(data, "isBase");
      if (factor.lte(0) || (isBase && !factor.eq(1)))
        throw new Error("Factor must be positive; base factor must be one.");
      if (old && (old.groupId !== groupId || !old.factor.eq(factor))) {
        const referenced =
          (await tx.item.count({
            where: {
              OR: [{ stockUomId: old.id }, { purchaseUomId: old.id }],
            },
          })) +
          (await tx.purchaseRequestLine.count({
            where: { uomId: old.id },
          })) +
          (await tx.purchaseOrderLine.count({
            where: { uomId: old.id },
          })) +
          (await tx.goodsReceiptLine.count({
            where: { uomId: old.id },
          })) +
          (await tx.materialConsumptionLine.count({
            where: { uomId: old.id },
          })) +
          (await tx.stockTransferLine.count({
            where: { uomId: old.id },
          }));
        if (referenced)
          throw new Error("Referenced UOM factors and groups cannot change.");
      }
      const base = await tx.uom.findFirst({
        where: { groupId, isBase: true },
      });
      if (isBase && base && base.id !== rowId)
        throw new Error("This group already has a base unit.");
      if (old?.isBase && (!isBase || old.groupId !== groupId))
        throw new Error("A group must keep its base unit.");
      if (!isBase && !base) throw new Error("Create a base unit first.");
      if (group.tenantId === null && isBase)
        throw new Error("System base units are read-only.");
      const fields = {
        groupId,
        code: name.parse(val(data, "code")),
        name: name.parse(val(data, "name")),
        factor,
        isBase,
      };
      entityId = (
        rowId
          ? await tx.uom.update({ where: { id: rowId }, data: fields })
          : await tx.uom.create({ data: { ...fields, tenantId } })
      ).id;
      break;
    }
  }
  return entityId;
}
