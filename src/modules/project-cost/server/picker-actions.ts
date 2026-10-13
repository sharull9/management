"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { resolveDocumentFx } from "@/modules/currency/server/rates";
export async function findCostStages(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  if (!ctx.isAdmin && !ctx.permissions.has("cost.view"))
    assertPermission(ctx, "expense.create");
  const search = z.string().max(150).parse(query);
  return (
    await db.stage.findMany({
      where: { projectId, name: { contains: search, mode: "insensitive" } },
      orderBy: { sequence: "asc" },
      take: 50,
      select: { id: true, name: true },
    })
  ).map((r) => ({ value: r.id, label: r.name }));
}
export async function findExpenseTasks(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "expense.create");
  const search = z.string().max(150).parse(query);
  return (
    await db.task.findMany({
      where: {
        projectId,
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      },
      orderBy: { title: "asc" },
      take: 50,
      select: { id: true, title: true, code: true },
    })
  ).map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` }));
}
export async function findExpenseParties(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "expense.create");
  const search = z.string().max(150).parse(query);
  return (
    await db.party.findMany({
      where: {
        tenantId: ctx.tenant.id,
        displayName: { contains: search, mode: "insensitive" },
      },
      orderBy: { displayName: "asc" },
      take: 50,
      select: { id: true, displayName: true },
    })
  ).map((r) => ({ value: r.id, label: r.displayName }));
}

export type ExpenseFx = {
  exchangeRate: string | null;
  baseCurrency: string;
  message: string | null;
};

/** The dated rate prefilled on the expense form; a missing rate is a message, not an error. */
export async function expenseFx(
  org: string,
  projectId: string,
  currency: string,
  date: string,
): Promise<ExpenseFx> {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "expense.create");
  const input = z
    .object({
      currency: z.string().regex(/^[A-Z]{3}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .parse({ currency, date });
  try {
    const fx = await resolveDocumentFx(db, {
      organizationId: ctx.org.id,
      currency: input.currency,
      date: input.date,
    });
    return {
      exchangeRate: fx.exchangeRate.toString(),
      baseCurrency: fx.baseCurrency,
      message: null,
    };
  } catch (error) {
    return {
      exchangeRate: null,
      baseCurrency: ctx.org.baseCurrency,
      message: error instanceof Error ? error.message : "Rate unavailable.",
    };
  }
}
