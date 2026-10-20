import assert from "node:assert/strict";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";

export async function createLedgerTestFixture(tx: Prisma.TransactionClient) {
  const token = `accounting-test-${crypto.randomUUID()}`;
  const tenant = await tx.tenant.create({
    data: { name: token, slug: token },
  });
  const org = await tx.organization.create({
    data: { name: token, slug: token, tenantId: tenant.id },
  });
  const otherOrg = await tx.organization.create({
    data: {
      name: `${token}-other`,
      slug: `${token}-other`,
      tenantId: tenant.id,
    },
  });
  const user = await tx.user.create({
    data: { name: token, email: `${token}@example.test` },
  });
  await tx.tenantMember.create({
    data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
  });
  const memberUser = await tx.user.create({
    data: {
      name: `${token}-member`,
      email: `${token}-member@example.test`,
    },
  });
  await tx.tenantMember.create({
    data: { tenantId: tenant.id, userId: memberUser.id, role: "MEMBER" },
  });
  const ctx = {
    org,
    tenant,
    user,
    isAdmin: true,
    permissions: new Set<string>(),
    member: null,
    tenantRole: "OWNER",
  } as unknown as OrgContext;
  const { ensureOrgChart } = await import("./chart-service");
  const chart = await ensureOrgChart(tx, org.id, user.id);
  const otherChart = await ensureOrgChart(tx, otherOrg.id, user.id);
  const sourceInput = {
    organizationId: org.id,
    actorId: user.id,
    sourceType: "TEST",
    sourceId: "source-1",
    date: new Date("2026-01-10T00:00:00Z"),
    description: "Original source",
    lines: [
      {
        accountKey: "MATERIAL_EXPENSE" as const,
        debit: "125.50",
        credit: "0",
        taxName: "GST",
        taxRate: "18",
        taxBaseAmount: "100",
      },
      {
        accountKey: "EXPENSE_PAYABLE" as const,
        debit: "0",
        credit: "125.50",
        taxName: "GST",
        taxRate: "18",
        taxBaseAmount: "-100",
      },
    ],
  };
  return {
    token,
    tenant,
    org,
    otherOrg,
    user,
    memberUser,
    ctx,
    chart,
    otherChart,
    sourceInput,
  };
}

export async function verifySourceHistory(
  tx: Prisma.TransactionClient,
  sourceInput: {
    organizationId: string;
    actorId: string;
    sourceType: string;
    sourceId: string;
    date: Date;
    description: string;
    lines: Array<Record<string, unknown>>;
  },
) {
  const { syncSourceJournal } = await import("./posting-service");
  const original = await syncSourceJournal(tx, sourceInput as never);
  assert.ok(original);
  const retry = await syncSourceJournal(tx, sourceInput as never);
  assert.equal(
    retry?.id,
    original.id,
    "identical source sync must be idempotent",
  );
  const replacement = await syncSourceJournal(tx, {
    ...sourceInput,
    date: new Date("2026-01-12T00:00:00Z"),
    description: "Revised source",
    lines: [
      {
        accountKey: "MATERIAL_EXPENSE",
        debit: "150",
        credit: "0",
        taxName: "GST",
        taxRate: "18",
        taxBaseAmount: "120",
      },
      {
        accountKey: "EXPENSE_PAYABLE",
        debit: "0",
        credit: "150",
        taxName: "GST",
        taxRate: "18",
        taxBaseAmount: "-120",
      },
    ],
  } as never);
  assert.ok(replacement && replacement.id !== original.id);
  const originalLines = await tx.journalLine.findMany({
    where: { journalEntryId: original.id },
    orderBy: { accountId: "asc" },
  });
  const reversal = await tx.journalEntry.findFirstOrThrow({
    where: { reversalOfId: original.id },
    include: { lines: true },
  });
  assert.equal(reversal.status, "POSTED");
  assert.equal(reversal.date.toISOString().slice(0, 10), "2026-01-10");
  const oldLine = originalLines[0];
  assert.ok(oldLine);
  const reversedOriginal = reversal.lines.find(
    (line) => line.accountId === oldLine.accountId,
  );
  assert.ok(reversedOriginal);
  assert.equal(reversedOriginal.debit.toFixed(2), oldLine.credit.toFixed(2));
  assert.equal(reversedOriginal.credit.toFixed(2), oldLine.debit.toFixed(2));
  assert.equal(
    reversedOriginal.taxBaseAmount?.toFixed(2),
    oldLine.taxBaseAmount?.neg().toFixed(2),
  );
  assert.equal(
    await syncSourceJournal(tx, { ...sourceInput, lines: [] } as never),
    null,
  );
  const replacementId = replacement.id;
  const removal = await tx.journalEntry.findFirstOrThrow({
    where: { reversalOfId: replacementId },
    include: { lines: true },
  });
  const replacementLines = await tx.journalLine.findMany({
    where: { journalEntryId: replacementId },
  });
  for (const line of replacementLines) {
    const reversed = removal.lines.find(
      (item) => item.accountId === line.accountId,
    );
    assert.equal(
      reversed?.taxBaseAmount?.toFixed(2),
      line.taxBaseAmount?.negated().toFixed(2),
    );
  }
  assert.equal(
    await syncSourceJournal(tx, { ...sourceInput, lines: [] } as never),
    null,
    "removal retries must be no-ops",
  );
  const posted = await syncSourceJournal(tx, {
    ...sourceInput,
    sourceId: "immutable",
    lines: sourceInput.lines,
  } as never);
  assert.ok(posted);
  return { original, replacement, posted };
}

export async function verifyJournalApprovalCallbacks(
  tx: Prisma.TransactionClient,
  {
    token,
    org,
    user,
    custom,
    chart,
  }: Pick<
    Awaited<ReturnType<typeof createLedgerTestFixture>>,
    "token" | "org" | "user" | "chart"
  > & { custom: { id: string } },
) {
  const { journalApproval } = await import("./approval");
  const cash = chart.get("CASH");
  assert.ok(cash);
  // Final approval callbacks are exercised with locally created requests and pending journals.
  for (const outcome of ["approve", "reject", "cancel"] as const) {
    const pending = await tx.journalEntry.create({
      data: {
        organizationId: org.id,
        code: `${token}-${outcome}`,
        date: new Date("2026-04-01Z"),
        description: outcome,
        status: "DRAFT",
        sourceType: "MANUAL",
        createdById: user.id,
      },
    });
    await tx.journalLine.createMany({
      data: [
        {
          organizationId: org.id,
          journalEntryId: pending.id,
          accountId: custom.id,
          debit: "7",
          credit: "0",
        },
        {
          organizationId: org.id,
          journalEntryId: pending.id,
          accountId: cash.id,
          debit: "0",
          credit: "7",
        },
      ],
    });
    await tx.journalEntry.update({
      where: { id: pending.id },
      data: { status: "PENDING_APPROVAL" },
    });
    const request = await tx.approvalRequest.create({
      data: {
        organizationId: org.id,
        documentType: "JOURNAL",
        documentId: pending.id,
        title: outcome,
        requestedById: user.id,
      },
    });
    await tx.journalEntry.update({
      where: { id: pending.id },
      data: { approvalRequestId: request.id },
    });
    const handler =
      outcome === "approve"
        ? journalApproval.onApproved
        : outcome === "reject"
          ? journalApproval.onRejected
          : journalApproval.onCanceled;
    assert.ok(
      handler,
      "each approval outcome has a registered journal callback",
    );
    await handler(request, tx, user.id);
    const changed = await tx.journalEntry.findUniqueOrThrow({
      where: { id: pending.id },
    });
    assert.equal(changed.status, outcome === "approve" ? "POSTED" : "DRAFT");
    assert.equal(
      changed.approvalRequestId,
      outcome === "approve" ? request.id : null,
    );
  }
}
