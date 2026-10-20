"use server";
import type { z } from "zod";
import { z as zod } from "zod";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { typedAction } from "@/core/typed-action";
import {
  accountInput,
  journalIdInput,
  journalInput,
  reverseJournalInput,
  templateInput,
} from "../schema";
import { applyTemplates, saveAccount, saveTemplate } from "./chart-service";
import { reverseJournal, saveJournal, submitJournal } from "./journal-service";

export async function saveAccountAction(
  org: string,
  raw: z.input<typeof accountInput>,
) {
  return typedAction(accountInput, async (input) => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "accounting.manage");
    await db.$transaction((tx) => saveAccount(tx, ctx, input), {
      timeout: 20000,
    });
  })(raw);
}
export async function saveTemplateAction(
  org: string,
  raw: z.input<typeof templateInput>,
) {
  return typedAction(templateInput, async (input) => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "accounting.manage");
    await db.$transaction((tx) => saveTemplate(tx, ctx, input), {
      timeout: 20000,
    });
  })(raw);
}
export async function applyTemplatesAction(
  org: string,
  raw: Record<string, never>,
) {
  return typedAction(zod.object({}), async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "accounting.manage");
    await db.$transaction((tx) => applyTemplates(tx, ctx), { timeout: 20000 });
  })(raw);
}
export async function saveJournalAction(
  org: string,
  raw: z.input<typeof journalInput>,
) {
  return typedAction(journalInput, async (input) => {
    const ctx = await requireOrgContext(org);
    if (
      !input.id ||
      (!ctx.isAdmin && !ctx.permissions.has("accounting.manage"))
    ) {
      assertPermission(ctx, "journal.create");
    }
    const row = await db.$transaction((tx) => saveJournal(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/accounting/journals/${row.id}`;
  })(raw);
}
export async function submitJournalAction(
  org: string,
  raw: z.input<typeof journalIdInput>,
) {
  return typedAction(journalIdInput, async ({ id }) => {
    await submitJournal(org, id);
  })(raw);
}
export async function reverseJournalAction(
  org: string,
  raw: z.input<typeof reverseJournalInput>,
) {
  return typedAction(reverseJournalInput, async (input) => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "accounting.manage");
    const row = await db.$transaction((tx) => reverseJournal(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/accounting/journals/${row.id}`;
  })(raw);
}
