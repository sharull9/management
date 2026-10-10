"use server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { type ActionState, runAction } from "../action-result";
import { writeAudit } from "../audit";
import { assertPermission, requireOrgContext } from "../context";
import { db } from "../db";
import { resolveVariant, validateLocation } from "./service";

const name = z.string().trim().min(1).max(150);
const id = z.string().min(1).max(100);
const decimal = z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/);
const val = (data: FormData, key: string) => String(data.get(key) ?? "");
const opt = (data: FormData, key: string) => val(data, key).trim() || null;
const flag = (data: FormData, key: string) => data.get(key) === "on";
const entities = [
  "uomGroup",
  "uom",
  "category",
  "level",
  "levelValue",
  "item",
  "party",
  "taxComponent",
  "taxGroup",
  "address",
  "contact",
  "taxIdentifier",
] as const;

export async function saveMasterAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "masters.manage");
    const kind = z.enum(entities).parse(val(data, "kind"));
    const rowId = opt(data, "id");
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`masters:${ctx.tenant.id}`}))::text`;
        let entityId = rowId ?? "";
        const tenantId = ctx.tenant.id;
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
            const factor = new Prisma.Decimal(
              decimal.parse(val(data, "factor")),
            );
            const isBase = flag(data, "isBase");
            if (factor.lte(0) || (isBase && !factor.eq(1)))
              throw new Error(
                "Factor must be positive; base factor must be one.",
              );
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
                throw new Error(
                  "Referenced UOM factors and groups cannot change.",
                );
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
            const level = z.coerce
              .number()
              .int()
              .min(1)
              .max(5)
              .parse(val(data, "level"));
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
              (old.stockUomId !== stockUomId ||
                old.stockTracked !== stockTracked)
            )
              throw new Error(
                "Stock UOM and tracking cannot change after variants exist.",
              );
            const fields = {
              code: name.parse(val(data, "code")),
              name: name.parse(val(data, "name")),
              type: z
                .enum(["PRODUCT", "SERVICE", "RAW_MATERIAL"])
                .parse(val(data, "type")),
              stockUomId,
              purchaseUomId,
              categoryId,
              defaultTaxGroupId,
              stockTracked,
              active: flag(data, "active"),
              taxCode: z
                .string()
                .max(50)
                .nullable()
                .parse(opt(data, "taxCode")),
              description: z
                .string()
                .max(5000)
                .nullable()
                .parse(opt(data, "description")),
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
              const mode = z
                  .enum(["NOT_USED", "ANY", "LINKED"])
                  .parse(val(data, `mode${definition.level}`) || "NOT_USED"),
                required = flag(data, `required${definition.level}`);
              const linkedIds = data
                .getAll(`links${definition.level}`)
                .map(String);
              if (required && (mode === "NOT_USED" || !definition.enabled))
                throw new Error(
                  "Unused or disabled levels cannot be required.",
                );
              if (
                linkedIds.some(
                  (v) => !definition.values.some((x) => x.id === v),
                )
              )
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
          case "party": {
            if (rowId)
              await tx.party.findFirstOrThrow({
                where: { id: rowId, tenantId },
              });
            const fields = {
              code: name.parse(val(data, "code")),
              legalName: name.parse(val(data, "legalName")),
              displayName: name.parse(val(data, "displayName")),
              type: z.enum(["BUSINESS", "INDIVIDUAL"]).parse(val(data, "type")),
              isVendor: flag(data, "isVendor"),
              isCustomer: flag(data, "isCustomer"),
              email: opt(data, "email")
                ? z.email().parse(val(data, "email"))
                : null,
              phone: z.string().max(50).nullable().parse(opt(data, "phone")),
              paymentTerms: z.coerce
                .number()
                .int()
                .min(0)
                .max(3650)
                .parse(val(data, "paymentTerms")),
              creditLimit: z
                .string()
                .regex(/^\d{1,16}(?:\.\d{1,2})?$/)
                .parse(val(data, "creditLimit")),
            };
            if (!fields.isVendor && !fields.isCustomer)
              throw new Error("Select vendor, customer, or both.");
            entityId = (
              rowId
                ? await tx.party.update({ where: { id: rowId }, data: fields })
                : await tx.party.create({ data: { ...fields, tenantId } })
            ).id;
            break;
          }
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
              appliesTo: z
                .enum(["PURCHASE", "SALES", "BOTH"])
                .parse(val(data, "appliesTo")),
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
              scope: z
                .enum(["INTRA", "INTER", "ANY"])
                .parse(val(data, "scope")),
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
          case "address":
          case "contact":
          case "taxIdentifier": {
            const partyId = id.parse(val(data, "partyId"));
            await tx.party.findFirstOrThrow({
              where: { id: partyId, tenantId },
            });
            if (kind === "address") {
              if (rowId)
                await tx.partyAddress.findFirstOrThrow({
                  where: { id: rowId, partyId },
                });
              const location = {
                countryId: opt(data, "countryId"),
                stateId: opt(data, "stateId"),
                cityId: opt(data, "cityId"),
              };
              await validateLocation(tx, tenantId, location);
              const fields = {
                partyId,
                ...location,
                label: name.parse(val(data, "label")),
                addressLine1: name.parse(val(data, "addressLine1")),
                addressLine2: opt(data, "addressLine2"),
                postalCode: opt(data, "postalCode"),
                isDefault: flag(data, "isDefault"),
              };
              if (fields.isDefault)
                await tx.partyAddress.updateMany({
                  where: { partyId },
                  data: { isDefault: false },
                });
              entityId = (
                rowId
                  ? await tx.partyAddress.update({
                      where: { id: rowId },
                      data: fields,
                    })
                  : await tx.partyAddress.create({ data: fields })
              ).id;
            } else if (kind === "contact") {
              if (rowId)
                await tx.partyContact.findFirstOrThrow({
                  where: { id: rowId, partyId },
                });
              const fields = {
                partyId,
                name: name.parse(val(data, "name")),
                email: opt(data, "email")
                  ? z.email().parse(val(data, "email"))
                  : null,
                phone: z.string().max(50).nullable().parse(opt(data, "phone")),
                jobTitle: opt(data, "jobTitle"),
                isPrimary: flag(data, "isPrimary"),
              };
              if (fields.isPrimary)
                await tx.partyContact.updateMany({
                  where: { partyId },
                  data: { isPrimary: false },
                });
              entityId = (
                rowId
                  ? await tx.partyContact.update({
                      where: { id: rowId },
                      data: fields,
                    })
                  : await tx.partyContact.create({ data: fields })
              ).id;
            } else {
              if (rowId)
                await tx.taxIdentifier.findFirstOrThrow({
                  where: { id: rowId, partyId },
                });
              const fields = {
                partyId,
                label: name.parse(val(data, "label")),
                value: name.parse(val(data, "value")),
              };
              entityId = (
                rowId
                  ? await tx.taxIdentifier.update({
                      where: { id: rowId },
                      data: fields,
                    })
                  : await tx.taxIdentifier.create({ data: fields })
              ).id;
            }
            break;
          }
        }
        await writeAudit(
          {
            tenantId,
            organizationId: ctx.org.id,
            userId: ctx.user.id,
            entityType: kind,
            entityId,
            action: rowId ? "UPDATE" : "CREATE",
          },
          tx,
        );
      },
      { timeout: 20000 },
    );
  });
}
export async function deleteMasterAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "masters.manage");
    const kind = z.enum(entities).parse(val(data, "kind")),
      rowId = id.parse(val(data, "id"));
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`masters:${ctx.tenant.id}`}))::text`;
      const where = { id: rowId, tenantId: ctx.tenant.id };
      switch (kind) {
        case "uomGroup":
          await tx.uomGroup.findFirstOrThrow({ where });
          await tx.uom.deleteMany({
            where: { groupId: rowId, tenantId: ctx.tenant.id },
          });
          await tx.uomGroup.delete({ where: { id: rowId } });
          break;
        case "uom": {
          const unit = await tx.uom.findFirstOrThrow({ where });
          if (unit.isBase)
            throw new Error("A group must retain its base unit.");
          await tx.uom.delete({ where: { id: rowId } });
          break;
        }
        case "category":
          await tx.itemCategory.findFirstOrThrow({ where });
          await tx.itemCategory.delete({ where: { id: rowId } });
          break;
        case "level":
          await tx.itemLevelDefinition.findFirstOrThrow({ where });
          await tx.itemLevelDefinition.delete({ where: { id: rowId } });
          break;
        case "levelValue":
          await tx.itemLevelValue.findFirstOrThrow({ where });
          await tx.itemLevelValue.delete({ where: { id: rowId } });
          break;
        case "item": {
          await tx.item.findFirstOrThrow({ where });
          if (await tx.itemVariant.count({ where: { itemId: rowId } }))
            throw new Error(
              "Deactivate items with variants instead of deleting them.",
            );
          await tx.item.delete({ where: { id: rowId } });
          break;
        }
        case "party":
          await tx.party.findFirstOrThrow({ where });
          await tx.party.delete({ where: { id: rowId } });
          break;
        case "taxComponent":
          await tx.taxComponent.findFirstOrThrow({ where });
          await tx.taxComponent.delete({ where: { id: rowId } });
          break;
        case "taxGroup":
          await tx.taxGroup.findFirstOrThrow({ where });
          await tx.taxGroup.delete({ where: { id: rowId } });
          break;
        case "address":
          await tx.partyAddress.findFirstOrThrow({
            where: { id: rowId, party: { tenantId: ctx.tenant.id } },
          });
          await tx.partyAddress.delete({ where: { id: rowId } });
          break;
        case "contact":
          await tx.partyContact.findFirstOrThrow({
            where: { id: rowId, party: { tenantId: ctx.tenant.id } },
          });
          await tx.partyContact.delete({ where: { id: rowId } });
          break;
        case "taxIdentifier":
          await tx.taxIdentifier.findFirstOrThrow({
            where: { id: rowId, party: { tenantId: ctx.tenant.id } },
          });
          await tx.taxIdentifier.delete({ where: { id: rowId } });
          break;
      }
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          entityType: kind,
          entityId: rowId,
          action: "DELETE",
        },
        tx,
      );
    });
  });
}
export async function resolveVariantAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "masters.manage");
    await db.$transaction(async (tx) => {
      const variant = await resolveVariant(
        tx,
        ctx.tenant.id,
        id.parse(val(data, "itemId")),
        Array.from({ length: 5 }, (_, i) => opt(data, `level${i + 1}`)),
      );
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          entityType: "ItemVariant",
          entityId: variant.id,
          action: "RESOLVE",
        },
        tx,
      );
    });
  });
}
