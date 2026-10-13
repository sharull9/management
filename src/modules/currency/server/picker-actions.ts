"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";

const searchInput = z.string().trim().max(150);

/** The tenant's enabled currencies, filtered by code or name. */
export async function findCurrencies(
  org: string,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const ctx = await requireOrgContext(org);
  const rows = await db.currency.findMany({
    where: {
      active: true,
      tenantCurrencies: { some: { tenantId: ctx.tenant.id, enabled: true } },
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: { code: true, name: true, symbol: true },
    orderBy: { code: "asc" },
    take: 50,
  });
  return rows.map((row) => ({
    value: row.code,
    label: `${row.code} | ${row.name}`,
    description: row.symbol,
  }));
}
