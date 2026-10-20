import { UserFacingError } from "@/core/errors";
import "server-only";
import { writeAudit } from "@/core/audit";
import {
  assertPermission,
  type OrgContext,
  requireOrgContext,
} from "@/core/context";
import { db } from "@/core/db";
import { Decimal } from "@/core/decimal";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import { journalInput, reverseJournalInput } from "../schema";
import { validateJournalLines } from "../util";
import { reversePostedJournal } from "./posting-service";

type Tx = Prisma.TransactionClient;
type JournalInput = ReturnType<typeof journalInput.parse>;
type ReverseInput = ReturnType<typeof reverseJournalInput.parse>;

async function assertOrg(tx: Tx, ctx: OrgContext) {
  const org = await tx.organization.findUnique({
    where: { id: ctx.org.id },
    select: {
      id: true,
      tenantId: true,
      baseCurrencyRef: { select: { decimals: true } },
    },
  });
  if (!org || org.tenantId !== ctx.tenant.id)
    throw new UserFacingError("Organization does not belong to this tenant.");
  return org;
}

async function validateInput(tx: Tx, ctx: OrgContext, input: JournalInput) {
  const org = await assertOrg(tx, ctx);
  const totals = validateJournalLines(
    input.lines,
    org.baseCurrencyRef.decimals,
  );
  const max = new Decimal("9999999999999999.99");
  if (totals.debit.gt(max) || totals.credit.gt(max))
    throw new UserFacingError(
      "Journal total exceeds the maximum supported amount.",
    );
  const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
  const projectIds = [
    ...new Set(
      input.lines.flatMap((line) => (line.projectId ? [line.projectId] : [])),
    ),
  ];
  const partyIds = [
    ...new Set(
      input.lines.flatMap((line) => (line.partyId ? [line.partyId] : [])),
    ),
  ];
  const [accounts, projects, parties] = await Promise.all([
    tx.ledgerAccount.findMany({
      where: { organizationId: org.id, id: { in: accountIds }, active: true },
      select: { id: true },
    }),
    projectIds.length
      ? tx.project.findMany({
          where: { organizationId: org.id, id: { in: projectIds } },
          select: { id: true },
        })
      : [],
    partyIds.length
      ? tx.party.findMany({
          where: { tenantId: org.tenantId, id: { in: partyIds } },
          select: { id: true },
        })
      : [],
  ]);
  if (accounts.length !== accountIds.length)
    throw new UserFacingError(
      "Every journal account must be active and belong to this organization.",
    );
  if (projects.length !== projectIds.length)
    throw new UserFacingError(
      "Every journal project must belong to this organization.",
    );
  if (parties.length !== partyIds.length)
    throw new UserFacingError(
      "Every journal party must belong to this tenant.",
    );
}

export async function saveJournal(
  tx: Tx,
  ctx: OrgContext,
  rawInput: JournalInput,
) {
  const input = journalInput.parse(rawInput);
  if (
    !input.id ||
    (!ctx.isAdmin && !ctx.permissions.has("accounting.manage"))
  ) {
    assertPermission(ctx, "journal.create");
  }
  const org = await assertOrg(tx, ctx);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`accounting:${org.id}`}))::text`;
  // Re-read after acquiring the organization lock so concurrent edits cannot use stale status/ownership.
  const existing = input.id
    ? await tx.journalEntry.findFirst({
        where: { id: input.id, organizationId: org.id },
      })
    : null;
  if (input.id && !existing)
    throw new UserFacingError("Journal not found in this organization.");
  if (
    existing &&
    (existing.sourceType !== "MANUAL" ||
      existing.reversalOfId ||
      existing.status !== "DRAFT")
  )
    throw new UserFacingError("Only an unposted manual draft can be edited.");
  if (
    existing &&
    existing.createdById !== ctx.user.id &&
    !ctx.isAdmin &&
    !ctx.permissions.has("accounting.manage")
  )
    throw new UserFacingError("You can only edit your own manual drafts.");
  await validateInput(tx, ctx, input);
  const date = new Date(`${input.date}T00:00:00.000Z`);
  const row = existing
    ? await tx.journalEntry.update({
        where: { id: existing.id },
        data: { date, description: input.description },
      })
    : await tx.journalEntry.create({
        data: {
          organizationId: org.id,
          code: await nextDocumentNumber(org.id, "JRN", tx),
          date,
          description: input.description,
          sourceType: "MANUAL",
          createdById: ctx.user.id,
        },
      });
  if (existing)
    await tx.journalLine.deleteMany({
      where: { journalEntryId: row.id, organizationId: org.id },
    });
  await tx.journalLine.createMany({
    data: input.lines.map((line) => ({
      journalEntryId: row.id,
      organizationId: org.id,
      accountId: line.accountId,
      description: line.description,
      debit: new Decimal(line.debit),
      credit: new Decimal(line.credit),
      projectId: line.projectId,
      partyId: line.partyId,
    })),
  });
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: org.id,
      userId: ctx.user.id,
      entityType: "JournalEntry",
      entityId: row.id,
      action: existing ? "UPDATE_DRAFT" : "CREATE_DRAFT",
    },
    tx,
  );
  return row;
}

export async function submitJournal(orgSlug: string, id: string) {
  const ctx = await requireOrgContext(orgSlug);
  if (!ctx.isAdmin && !ctx.permissions.has("accounting.manage"))
    assertPermission(ctx, "journal.create");
  await db.$transaction(
    async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: ctx.org.id },
        select: { id: true, tenantId: true },
      });
      if (!org || org.tenantId !== ctx.tenant.id)
        throw new UserFacingError(
          "Organization does not belong to this tenant.",
        );
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`accounting:${org.id}`}))::text`;
      const row = await tx.journalEntry.findFirst({
        where: { id, organizationId: org.id },
        include: { lines: true },
      });
      if (
        !row ||
        row.sourceType !== "MANUAL" ||
        row.status !== "DRAFT" ||
        row.reversalOfId
      )
        throw new UserFacingError(
          "Only a manual draft journal can be submitted.",
        );
      if (
        row.createdById !== ctx.user.id &&
        !ctx.isAdmin &&
        !ctx.permissions.has("accounting.manage")
      )
        throw new UserFacingError(
          "You can only submit your own manual drafts.",
        );
      const currency = await tx.organization.findUniqueOrThrow({
        where: { id: org.id },
        select: { baseCurrencyRef: { select: { decimals: true } } },
      });
      const totals = validateJournalLines(
        row.lines,
        currency.baseCurrencyRef.decimals,
      );
      const { submitForApproval } = await import(
        "@/modules/approvals/server/service"
      );
      const approval = await submitForApproval(
        {
          orgSlug,
          documentType: "JOURNAL",
          documentId: row.id,
          title: `${row.code} - Journal`,
          projectId: null,
          amount: totals.debit.toString(),
        },
        tx,
        ctx,
      );
      await tx.journalEntry.update({
        where: { id: row.id },
        data: { status: "PENDING_APPROVAL", approvalRequestId: approval.id },
      });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: org.id,
          userId: ctx.user.id,
          entityType: "JournalEntry",
          entityId: row.id,
          action: "SUBMIT",
        },
        tx,
      );
    },
    { timeout: 20000 },
  );
}

export async function reverseJournal(
  tx: Tx,
  ctx: OrgContext,
  rawInput: ReverseInput,
) {
  assertPermission(ctx, "accounting.manage");
  const input = reverseJournalInput.parse(rawInput);
  const org = await assertOrg(tx, ctx);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`accounting:${org.id}`}))::text`;
  const original = await tx.journalEntry.findFirst({
    where: { id: input.id, organizationId: org.id },
    include: { reversal: { select: { id: true } } },
  });
  if (
    !original ||
    original.status !== "POSTED" ||
    original.sourceType !== "MANUAL" ||
    original.reversalOfId ||
    original.reversal
  )
    throw new UserFacingError(
      "Only an unreversed posted manual journal can be reversed.",
    );
  const day = new Date(`${input.date}T00:00:00.000Z`);
  if (day < original.date)
    throw new UserFacingError(
      "A reversal date cannot predate the original journal.",
    );
  return reversePostedJournal(tx, {
    organizationId: org.id,
    actorId: ctx.user.id,
    journalId: original.id,
    date: day,
    reason: input.reason,
  });
}
