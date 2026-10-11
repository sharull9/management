"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
export async function findTenantUsers(
  orgSlug: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireOrgContext(orgSlug);
  assertPermission(ctx, "members.manage");
  const search = z.string().max(150).parse(query).trim();
  const users = await db.user.findMany({
    where: {
      tenantMembers: { some: { tenantId: ctx.tenant.id } },
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { name: true, email: true },
    orderBy: { name: "asc" },
    take: 30,
  });
  return users.map((user) => ({
    value: user.email,
    label: user.name,
    description: user.email,
  }));
}
