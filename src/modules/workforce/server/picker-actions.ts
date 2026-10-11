"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
export async function findWorkforceWorkers(
  org: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireOrgContext(org);
  if (!ctx.isAdmin && !ctx.permissions.has("workforce.manage"))
    assertPermission(ctx, "workforce.view");
  const search = z.string().max(150).parse(query);
  return (
    await db.worker.findMany({
      where: {
        organizationId: ctx.org.id,
        name: { contains: search, mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true },
    })
  ).map((r) => ({ value: r.id, label: r.name }));
}
