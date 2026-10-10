import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { decimal, name, taxAppliesToSchema, taxScopeSchema } from "../schema";
import type { MasterKind } from "../type";
import { flag, opt, val } from "./form-data";
export async function saveTaxMaster(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: MasterKind,
  rowId: string | null,
  data: FormData,
) {
  let entityId = rowId ?? "";
  switch (kind) {
    case "taxComponent": {
      if (rowId)
        await tx.taxComponent.findFirstOrThrow({
          where: { id: rowId, tenantId },
        });
      const fields = {
        name: name.parse(val(data, "name")),
        code: name.parse(val(data, "code")),
        rate: decimal.parse(val(data, "rate")),
        isWithholding: flag(data, "isWithholding"),
        appliesTo: taxAppliesToSchema.parse(val(data, "appliesTo")),
      };
      if (new Prisma.Decimal(fields.rate).gt(100))
        throw new Error("Tax rate cannot exceed 100%.");
      entityId = (
        rowId
          ? await tx.taxComponent.update({
              where: { id: rowId },
              data: fields,
            })
          : await tx.taxComponent.create({
              data: { ...fields, tenantId },
            })
      ).id;
      break;
    }
    case "taxGroup": {
      if (rowId)
        await tx.taxGroup.findFirstOrThrow({
          where: { id: rowId, tenantId },
        });
      const componentIds = [
        ...new Set(data.getAll("componentIds").map(String)),
      ];
      if (
        (await tx.taxComponent.count({
          where: { id: { in: componentIds }, tenantId },
        })) !== componentIds.length
      )
        throw new Error("Invalid tax components.");
      const fields = {
        name: name.parse(val(data, "name")),
        countryId: opt(data, "countryId"),
        scope: taxScopeSchema.parse(val(data, "scope")),
      };
      if (fields.countryId)
        await tx.country.findUniqueOrThrow({
          where: { id: fields.countryId },
        });
      const group = rowId
        ? await tx.taxGroup.update({ where: { id: rowId }, data: fields })
        : await tx.taxGroup.create({ data: { ...fields, tenantId } });
      entityId = group.id;
      await tx.taxGroupComponent.deleteMany({
        where: { groupId: group.id },
      });
      await tx.taxGroupComponent.createMany({
        data: componentIds.map((componentId, sequence) => ({
          groupId: group.id,
          componentId,
          sequence,
        })),
      });
      break;
    }
  }
  return entityId;
}
