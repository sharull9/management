"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { id, masterKindSchema } from "../schema";
import { opt, val } from "./form-data";
import { saveItemMaster } from "./item-service";
import { savePartyMaster } from "./party-service";
import { resolveVariant } from "./service";
import { saveTaxMaster } from "./tax-service";
import { saveUomMaster } from "./uom-service";

export async function saveMasterAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "masters.manage");
    const kind = masterKindSchema.parse(val(data, "kind"));
    const rowId = opt(data, "id");
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`masters:${ctx.tenant.id}`}))::text`;
        let entityId = rowId ?? "";
        const tenantId = ctx.tenant.id;
        switch (kind) {
          case "uomGroup":
          case "uom":
            entityId = await saveUomMaster(tx, tenantId, kind, rowId, data);
            break;
          case "category":
          case "level":
          case "levelValue":
          case "item":
            entityId = await saveItemMaster(tx, tenantId, kind, rowId, data);
            break;
          case "party":
          case "address":
          case "contact":
          case "taxIdentifier":
            entityId = await savePartyMaster(tx, tenantId, kind, rowId, data);
            break;
          case "taxComponent":
          case "taxGroup":
            entityId = await saveTaxMaster(tx, tenantId, kind, rowId, data);
            break;
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
    const kind = masterKindSchema.parse(val(data, "kind")),
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
