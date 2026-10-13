"use server";
import { z } from "zod";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";

/** The party's default currency, or null (callers fall back to the base currency). */
export async function partyDefaultCurrency(org: string, partyId: string) {
  const id = z.string().min(1).max(100).parse(partyId);
  const ctx = await requireOrgContext(org);
  const party = await db.party.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    select: { defaultCurrency: true },
  });
  return party?.defaultCurrency ?? null;
}
