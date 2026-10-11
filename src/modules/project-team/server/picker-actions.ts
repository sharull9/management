"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
export async function findWorkers(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "project.edit");
  const search = z.string().trim().max(150).parse(query);
  const rows = await db.worker.findMany({
    where: {
      organizationId: ctx.org.id,
      active: true,
      name: { contains: search, mode: "insensitive" },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return rows.map((row) => ({ value: row.id, label: row.name }));
}
