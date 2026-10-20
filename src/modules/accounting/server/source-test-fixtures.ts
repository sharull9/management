import assert from "node:assert/strict";
import type { Prisma } from "@/generated/prisma/client";

export type SourceTx = Prisma.TransactionClient;

export async function sourceTestBase(tx: SourceTx) {
  const token = `acct-source-${crypto.randomUUID()}`;
  const tenant = await tx.tenant.create({ data: { name: token, slug: token } });
  const org = await tx.organization.create({
    data: { name: token, slug: token, tenantId: tenant.id },
  });
  const user = await tx.user.create({
    data: { name: token, email: `${token}@example.test` },
  });
  const party = await tx.party.create({
    data: {
      tenantId: tenant.id,
      code: "V",
      legalName: token,
      displayName: token,
      isVendor: true,
      isCustomer: true,
    },
  });
  const project = await tx.project.create({
    data: { organizationId: org.id, code: "P", name: token, currency: "INR" },
  });
  return { token, tenant, org, user, party, project };
}

export async function postedLines(
  tx: SourceTx,
  organizationId: string,
  sourceType: string,
  sourceId: string,
) {
  const source = await tx.accountingSource.findUniqueOrThrow({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId,
        sourceType,
        sourceId,
      },
    },
  });
  if (!source.currentEntryId) return [];
  return tx.journalLine.findMany({
    where: { journalEntryId: source.currentEntryId },
    include: { account: true },
  });
}

export function expectBalance(
  lines: { debit: { toString(): string }; credit: { toString(): string } }[],
) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
  assert.equal(debit.toFixed(2), credit.toFixed(2));
}

export async function expectSourceCurrent(
  tx: SourceTx,
  organizationId: string,
  sourceType: string,
  sourceId: string,
  key: string,
  debit: string,
  credit: string,
) {
  const lines = await postedLines(tx, organizationId, sourceType, sourceId);
  const selected = lines.filter((line) => line.account.systemKey === key);
  assert.equal(
    selected.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(2),
    debit,
  );
  assert.equal(
    selected.reduce((sum, line) => sum + Number(line.credit), 0).toFixed(2),
    credit,
  );
  expectBalance(lines);
  return lines;
}
