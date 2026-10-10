import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { variantIdentity } from "@/modules/item-variant";

export async function resolveVariant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  chosen: (string | null)[],
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`masters:${tenantId}`}))::text`;
  const item = await tx.item.findFirstOrThrow({
    where: { id: itemId, tenantId, active: true },
    include: {
      levelConfigs: {
        include: { definition: { include: { values: true } }, links: true },
      },
    },
  });
  const identity = variantIdentity(
    item,
    item.levelConfigs.map((c) => ({
      level: c.definition.level,
      name: c.definition.name,
      enabled: c.definition.enabled,
      mode: c.mode,
      required: c.required,
      values: c.definition.values,
      linkedIds: c.links.map((l) => l.valueId),
    })),
    chosen,
  );
  return tx.itemVariant.upsert({
    where: { key: identity.key },
    update: {},
    create: {
      itemId,
      key: identity.key,
      name: identity.name,
      level1Id: identity.ids[0],
      level2Id: identity.ids[1],
      level3Id: identity.ids[2],
      level4Id: identity.ids[3],
      level5Id: identity.ids[4],
    },
  });
}
export async function validateLocation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  location: {
    countryId: string | null;
    stateId: string | null;
    cityId: string | null;
  },
) {
  if (location.countryId)
    await tx.country.findUniqueOrThrow({ where: { id: location.countryId } });
  if (
    location.stateId &&
    !(await tx.state.findFirst({
      where: { id: location.stateId, countryId: location.countryId ?? "" },
    }))
  )
    throw new Error("State must belong to the selected country.");
  if (
    location.cityId &&
    !(await tx.city.findFirst({
      where: { id: location.cityId, stateId: location.stateId ?? "", tenantId },
    }))
  )
    throw new Error("City must belong to this tenant and selected state.");
}
