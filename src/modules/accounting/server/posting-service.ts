import { UserFacingError } from "@/core/errors";
import "server-only";
import { writeAudit } from "@/core/audit";
import { Decimal, type Numeric } from "@/core/decimal";
import { nextDocumentNumber } from "@/core/numbering";
import type { Prisma } from "@/generated/prisma/client";
import type { SystemAccountKey } from "../constants";
import { reverseLines, validateJournalLines } from "../util";
import { ensureOrgChart } from "./chart-service";
import { lockAccountingScope } from "./locking";
import {
  canonicalAmount,
  sourceFingerprint,
  utcDay,
} from "./posting-normalize";

type Tx = Prisma.TransactionClient;
export type SourceJournalLine = {
  accountKey: SystemAccountKey;
  debit: Numeric;
  credit: Numeric;
  description?: string;
  projectId?: string | null;
  partyId?: string | null;
  taxComponentId?: string | null;
  taxName?: string | null;
  taxRate?: Numeric | null;
  taxBaseAmount?: Numeric | null;
};

async function currencyDecimals(tx: Tx, organizationId: string) {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { baseCurrencyRef: { select: { decimals: true } } },
  });
  if (!org) throw new UserFacingError("Organization not found.");
  return org.baseCurrencyRef.decimals;
}

async function validateResolvedLines(
  tx: Tx,
  organizationId: string,
  lines: readonly {
    accountId: string;
    debit: Numeric;
    credit: Numeric;
    projectId?: string | null;
    partyId?: string | null;
    taxComponentId?: string | null;
    taxRate?: Numeric | null;
    taxBaseAmount?: Numeric | null;
  }[],
) {
  const decimals = await currencyDecimals(tx, organizationId);
  validateJournalLines(lines, decimals);
  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const projectIds = [
    ...new Set(
      lines.flatMap((line) => (line.projectId ? [line.projectId] : [])),
    ),
  ];
  const partyIds = [
    ...new Set(lines.flatMap((line) => (line.partyId ? [line.partyId] : []))),
  ];
  const taxIds = [
    ...new Set(
      lines.flatMap((line) =>
        line.taxComponentId ? [line.taxComponentId] : [],
      ),
    ),
  ];
  const [accounts, projects, parties, taxes] = await Promise.all([
    tx.ledgerAccount.findMany({
      where: { id: { in: accountIds }, organizationId, active: true },
      select: { id: true },
    }),
    projectIds.length
      ? tx.project.findMany({
          where: { id: { in: projectIds }, organizationId },
          select: { id: true },
        })
      : [],
    partyIds.length
      ? tx.party.findMany({
          where: {
            id: { in: partyIds },
            tenantId: (
              await tx.organization.findUniqueOrThrow({
                where: { id: organizationId },
                select: { tenantId: true },
              })
            ).tenantId,
          },
          select: { id: true },
        })
      : [],
    taxIds.length
      ? tx.taxComponent.findMany({
          where: {
            id: { in: taxIds },
            tenantId: (
              await tx.organization.findUniqueOrThrow({
                where: { id: organizationId },
                select: { tenantId: true },
              })
            ).tenantId,
          },
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
  if (taxes.length !== taxIds.length)
    throw new UserFacingError(
      "Every tax component must belong to this tenant.",
    );
  for (const line of lines) {
    if (line.taxRate != null) {
      const rate = new Decimal(line.taxRate);
      if (!rate.isFinite() || rate.lt(0) || rate.decimalPlaces() > 4)
        throw new UserFacingError(
          "Tax rate must be a non-negative value with up to four decimals.",
        );
    }
    if (line.taxBaseAmount != null) {
      const base = new Decimal(line.taxBaseAmount);
      if (!base.isFinite() || base.decimalPlaces() > decimals)
        throw new UserFacingError(
          "Tax base amount exceeds base currency precision.",
        );
    }
  }
}

async function createPosted(
  tx: Tx,
  input: {
    organizationId: string;
    actorId: string;
    date: Date;
    description: string;
    sourceType: string;
    sourceDocumentId?: string | null;
    accountingSourceId?: string | null;
    revision?: number | null;
    reversalOfId?: string | null;
    lines: readonly {
      accountId: string;
      debit: Numeric;
      credit: Numeric;
      description?: string;
      projectId?: string | null;
      partyId?: string | null;
      taxComponentId?: string | null;
      taxName?: string | null;
      taxRate?: Numeric | null;
      taxBaseAmount?: Numeric | null;
    }[];
  },
) {
  const code = await nextDocumentNumber(input.organizationId, "JRN", tx);
  const draft = await tx.journalEntry.create({
    data: {
      organizationId: input.organizationId,
      code,
      date: utcDay(input.date),
      description: input.description,
      sourceType: input.sourceType,
      sourceDocumentId: input.sourceDocumentId ?? null,
      accountingSourceId: input.accountingSourceId ?? null,
      revision: input.revision ?? null,
      reversalOfId: input.reversalOfId ?? null,
      createdById: input.actorId,
    },
  });
  await tx.journalLine.createMany({
    data: input.lines.map((line) => ({
      journalEntryId: draft.id,
      organizationId: input.organizationId,
      accountId: line.accountId,
      description: line.description ?? "",
      debit: canonicalAmount(line.debit)!,
      credit: canonicalAmount(line.credit)!,
      projectId: line.projectId ?? null,
      partyId: line.partyId ?? null,
      taxComponentId: line.taxComponentId ?? null,
      taxName: line.taxName ?? null,
      taxRate: canonicalAmount(line.taxRate),
      taxBaseAmount: canonicalAmount(line.taxBaseAmount),
    })),
  });
  return postDraftJournal(tx, input.organizationId, draft.id, input.actorId);
}

export async function postDraftJournal(
  tx: Tx,
  organizationId: string,
  journalId: string,
  actorId: string,
) {
  const entry = await tx.journalEntry.findFirst({
    where: { id: journalId, organizationId },
    include: { lines: true },
  });
  if (!entry)
    throw new UserFacingError("Journal not found in this organization.");
  if (entry.status !== "DRAFT" && entry.status !== "PENDING_APPROVAL")
    throw new UserFacingError("Only a draft or pending journal can be posted.");
  await validateResolvedLines(tx, organizationId, entry.lines);
  const posted = await tx.journalEntry.update({
    where: { id: entry.id },
    data: { status: "POSTED", postedById: actorId, postedAt: new Date() },
  });
  await writeAudit(
    {
      organizationId,
      userId: actorId,
      entityType: "JournalEntry",
      entityId: posted.id,
      action: "POST",
    },
    tx,
  );
  return posted;
}

export async function reversePostedJournal(
  tx: Tx,
  input: {
    organizationId: string;
    actorId: string;
    journalId: string;
    date: Date | string;
    reason: string;
    accountingSourceId?: string;
    revision?: number;
  },
) {
  const original = await tx.journalEntry.findFirst({
    where: { id: input.journalId, organizationId: input.organizationId },
    include: { lines: true, reversal: { select: { id: true } } },
  });
  if (!original)
    throw new UserFacingError("Journal not found in this organization.");
  if (original.status !== "POSTED")
    throw new UserFacingError("Only a posted journal can be reversed.");
  if (original.reversal)
    throw new UserFacingError("This journal already has a reversal.");
  const date = utcDay(input.date);
  if (!input.reason.trim())
    throw new UserFacingError("A reversal reason is required.");
  const reversed = reverseLines(original.lines);
  await validateResolvedLines(tx, input.organizationId, reversed);
  const result = await createPosted(tx, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    date,
    description: input.reason.trim(),
    sourceType: original.sourceType,
    sourceDocumentId: original.sourceDocumentId,
    accountingSourceId: input.accountingSourceId ?? null,
    revision: input.revision ?? null,
    reversalOfId: original.id,
    lines: reversed,
  });
  await writeAudit(
    {
      organizationId: input.organizationId,
      userId: input.actorId,
      entityType: "JournalEntry",
      entityId: result.id,
      action: "REVERSE",
      changes: { reversalOfId: original.id, reason: input.reason.trim() },
    },
    tx,
  );
  return result;
}

export async function syncSourceJournal(
  tx: Tx,
  input: {
    organizationId: string;
    actorId: string;
    sourceType: string;
    sourceId: string;
    date: Date;
    description: string;
    lines: readonly SourceJournalLine[];
    reversalDate?: Date;
  },
) {
  await lockAccountingScope(tx, input.organizationId);
  const chart = await ensureOrgChart(tx, input.organizationId, input.actorId);
  const resolved = input.lines.map((line) => {
    const account = chart.get(line.accountKey);
    if (!account?.active)
      throw new UserFacingError(
        `Required system account ${line.accountKey} is missing or inactive.`,
      );
    return {
      accountId: account.id,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
      projectId: line.projectId,
      partyId: line.partyId,
      taxComponentId: line.taxComponentId,
      taxName: line.taxName,
      taxRate: line.taxRate,
      taxBaseAmount: line.taxBaseAmount,
    };
  });
  const date = utcDay(input.date);
  const fingerprint = input.lines.length
    ? sourceFingerprint({
        date: date.toISOString(),
        description: input.description,
        lines: resolved.map((line) => ({
          ...line,
          debit: canonicalAmount(line.debit),
          credit: canonicalAmount(line.credit),
          taxRate: canonicalAmount(line.taxRate),
          taxBaseAmount: canonicalAmount(line.taxBaseAmount),
          projectId: line.projectId ?? null,
          partyId: line.partyId ?? null,
          taxComponentId: line.taxComponentId ?? null,
          taxName: line.taxName ?? null,
          description: line.description ?? "",
        })),
      })
    : null;
  const source = await tx.accountingSource.upsert({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    create: {
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
    update: {},
  });
  if (
    fingerprint &&
    source.fingerprint === fingerprint &&
    source.currentEntryId
  )
    return tx.journalEntry.findFirstOrThrow({
      where: {
        id: source.currentEntryId,
        organizationId: input.organizationId,
      },
    });
  if (!fingerprint && !source.currentEntryId) return null;
  const current = source.currentEntryId
    ? await tx.journalEntry.findFirst({
        where: {
          id: source.currentEntryId,
          organizationId: input.organizationId,
        },
        include: { lines: true },
      })
    : null;
  if (current)
    await reversePostedJournal(tx, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      journalId: current.id,
      date: input.reversalDate ?? current.date,
      reason: `Reversal: ${current.description}`,
    });
  if (resolved.length === 0) {
    await tx.accountingSource.update({
      where: { id: source.id },
      data: {
        currentEntryId: null,
        fingerprint: null,
        revision: source.revision + (current ? 1 : 0),
      },
    });
    await writeAudit(
      {
        organizationId: input.organizationId,
        userId: input.actorId,
        entityType: "AccountingSource",
        entityId: source.id,
        action: current ? "REVERSE_SOURCE" : "SYNC_EMPTY",
      },
      tx,
    );
    return null;
  }
  await validateResolvedLines(tx, input.organizationId, resolved);
  const revision = source.revision + 1;
  const posted = await createPosted(tx, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    date,
    description: input.description,
    sourceType: input.sourceType,
    sourceDocumentId: input.sourceId,
    accountingSourceId: source.id,
    revision,
    lines: resolved,
  });
  await tx.accountingSource.update({
    where: { id: source.id },
    data: { currentEntryId: posted.id, fingerprint, revision },
  });
  await writeAudit(
    {
      organizationId: input.organizationId,
      userId: input.actorId,
      entityType: "AccountingSource",
      entityId: source.id,
      action: "SYNC_SOURCE",
      changes: { journalId: posted.id, revision },
    },
    tx,
  );
  return posted;
}

export async function removeSourceJournal(
  tx: Tx,
  input: {
    organizationId: string;
    actorId: string;
    sourceType: string;
    sourceId: string;
    description: string;
  },
) {
  await lockAccountingScope(tx, input.organizationId);
  const source = await tx.accountingSource.findUnique({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    select: { currentEntry: { select: { date: true } } },
  });
  return syncSourceJournal(tx, {
    ...input,
    date: source?.currentEntry?.date ?? new Date(),
    lines: [],
  });
}
