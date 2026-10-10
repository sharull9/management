import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  id,
  itemDescriptionSchema,
  itemLevelSchema,
  itemModeSchema,
  itemTaxCodeSchema,
  itemTypeSchema,
  name,
} from "../schema";
import type { MasterKind } from "../type";
import { flag, opt, val } from "./form-data";
export async function saveItemMaster(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: MasterKind,
  rowId: string | null,
  data: FormData,
) {
  let entityId = rowId ?? "";
  switch (kind) {
    case "category": {
      if (rowId)
        await tx.itemCategory.findFirstOrThrow({
          where: { id: rowId, tenantId },
        });
      const parentId = opt(data, "parentId");
      let ancestor = parentId,
        depth = 1;
      const seen = new Set<string>();
      while (ancestor) {
        if (ancestor === rowId || seen.has(ancestor))
          throw new Error("Category tree cannot contain cycles.");
        seen.add(ancestor);
        const p = await tx.itemCategory.findFirstOrThrow({
          where: { id: ancestor, tenantId },
        });
        depth++;
        ancestor = p.parentId;
      }
      const height = async (categoryId: string): Promise<number> => {
        const children = await tx.itemCategory.findMany({
          where: { parentId: categoryId, tenantId },
        });
        return children.length
          ? 1 +
              Math.max(
                ...(await Promise.all(children.map((c) => height(c.id)))),
              )
          : 1;
      };
      if (depth + (rowId ? await height(rowId) : 1) - 1 > 5)
        throw new Error("Category depth cannot exceed five.");
      const fields = { name: name.parse(val(data, "name")), parentId };
      entityId = (
        rowId
          ? await tx.itemCategory.update({
              where: { id: rowId },
              data: fields,
            })
          : await tx.itemCategory.create({
              data: { ...fields, tenantId },
            })
      ).id;
      break;
    }
    case "level": {
      const level = itemLevelSchema.parse(val(data, "level"));
      entityId = (
        await tx.itemLevelDefinition.upsert({
          where: { tenantId_level: { tenantId, level } },
          create: {
            tenantId,
            level,
            name: name.parse(val(data, "name")),
            enabled: flag(data, "enabled"),
          },
          update: {
            name: name.parse(val(data, "name")),
            enabled: flag(data, "enabled"),
          },
        })
      ).id;
      break;
    }
    case "levelValue": {
      const definitionId = id.parse(val(data, "definitionId"));
      await tx.itemLevelDefinition.findFirstOrThrow({
        where: { id: definitionId, tenantId },
      });
      if (rowId)
        await tx.itemLevelValue.findFirstOrThrow({
          where: { id: rowId, tenantId },
        });
      const fields = {
        name: name.parse(val(data, "name")),
        definitionId,
      };
      if (rowId) {
        const old = await tx.itemLevelValue.findUniqueOrThrow({
          where: { id: rowId },
        });
        if (old.definitionId !== definitionId)
          throw new Error("A value cannot move between levels.");
      }
      entityId = (
        rowId
          ? await tx.itemLevelValue.update({
              where: { id: rowId },
              data: fields,
            })
          : await tx.itemLevelValue.create({
              data: { ...fields, tenantId },
            })
      ).id;
      break;
    }
    case "item": {
      const old = rowId
        ? await tx.item.findFirstOrThrow({
            where: { id: rowId, tenantId },
            include: { variants: true },
          })
        : null;
      const stockUomId = id.parse(val(data, "stockUomId")),
        purchaseUomId = opt(data, "purchaseUomId");
      const stock = await tx.uom.findFirstOrThrow({
        where: { id: stockUomId, OR: [{ tenantId }, { tenantId: null }] },
      });
      if (purchaseUomId)
        await tx.uom.findFirstOrThrow({
          where: {
            id: purchaseUomId,
            groupId: stock.groupId,
            OR: [{ tenantId }, { tenantId: null }],
          },
        });
      const categoryId = opt(data, "categoryId"),
        defaultTaxGroupId = opt(data, "defaultTaxGroupId");
      if (categoryId)
        await tx.itemCategory.findFirstOrThrow({
          where: { id: categoryId, tenantId },
        });
      if (defaultTaxGroupId)
        await tx.taxGroup.findFirstOrThrow({
          where: { id: defaultTaxGroupId, tenantId },
        });
      const stockTracked = flag(data, "stockTracked");
      if (
        old?.variants.length &&
        (old.stockUomId !== stockUomId || old.stockTracked !== stockTracked)
      )
        throw new Error(
          "Stock UOM and tracking cannot change after variants exist.",
        );
      const fields = {
        code: name.parse(val(data, "code")),
        name: name.parse(val(data, "name")),
        type: itemTypeSchema.parse(val(data, "type")),
        stockUomId,
        purchaseUomId,
        categoryId,
        defaultTaxGroupId,
        stockTracked,
        active: flag(data, "active"),
        taxCode: itemTaxCodeSchema.parse(opt(data, "taxCode")),
        description: itemDescriptionSchema.parse(opt(data, "description")),
      };
      const item = rowId
        ? await tx.item.update({ where: { id: rowId }, data: fields })
        : await tx.item.create({ data: { ...fields, tenantId } });
      entityId = item.id;
      const definitions = await tx.itemLevelDefinition.findMany({
        where: { tenantId },
        include: { values: true },
      });
      for (const definition of definitions) {
        const mode = itemModeSchema.parse(
            val(data, `mode${definition.level}`) || "NOT_USED",
          ),
          required = flag(data, `required${definition.level}`);
        const linkedIds = data.getAll(`links${definition.level}`).map(String);
        if (required && (mode === "NOT_USED" || !definition.enabled))
          throw new Error("Unused or disabled levels cannot be required.");
        if (linkedIds.some((v) => !definition.values.some((x) => x.id === v)))
          throw new Error("Invalid linked level value.");
        if (mode === "LINKED" && required && !linkedIds.length)
          throw new Error("Required linked levels need allowed values.");
        const config = await tx.itemLevelConfig.upsert({
          where: {
            itemId_definitionId: {
              itemId: item.id,
              definitionId: definition.id,
            },
          },
          create: {
            itemId: item.id,
            definitionId: definition.id,
            mode,
            required,
          },
          update: { mode, required },
        });
        await tx.itemLevelLink.deleteMany({
          where: { configId: config.id },
        });
        if (mode === "LINKED")
          await tx.itemLevelLink.createMany({
            data: [...new Set(linkedIds)].map((valueId) => ({
              configId: config.id,
              valueId,
            })),
          });
      }
      break;
    }
  }
  return entityId;
}
