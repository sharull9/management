import assert from "node:assert/strict";
import test from "node:test";
import type { OrgContext } from "@/core/context";
import {
  expectAccountingFailure,
  withAccountingTestDatabase,
} from "./test-database";

test(
  "accounting ledger enforces source history, posted invariants, scope, and permissions",
  {
    skip: process.env.ACCOUNTING_DB_TEST !== "local-only",
  },
  async () => {
    await withAccountingTestDatabase(async (tx) => {
      const { createLedgerTestFixture, verifySourceHistory } = await import(
        "./newledger-test-fixtures"
      );
      const {
        token,
        org,
        user,
        memberUser,
        ctx,
        chart,
        otherChart,
        sourceInput,
      } = await createLedgerTestFixture(tx);
      const { original, posted } = await verifySourceHistory(tx, sourceInput);
      const { saveAccount, saveTemplate } = await import("./chart-service");
      const { syncSourceJournal } = await import("./posting-service");
      const { saveJournal, reverseJournal } = await import("./journal-service");
      const { syncCostEntryJournal } = await import("./source-costs");
      await expectAccountingFailure(
        tx,
        () =>
          tx.journalEntry.update({
            where: { id: posted.id },
            data: { description: "mutated" },
          }),
        /posted|immutable|only be changed while the parent is draft/i,
      );
      await expectAccountingFailure(
        tx,
        () =>
          tx.journalLine.updateMany({
            where: { journalEntryId: posted.id },
            data: { description: "mutated" },
          }),
        /posted|immutable|only be changed while the parent is draft/i,
      );
      // Deferred balance/shape trigger must reject a posted header even when the violation is deferred.
      await tx.$executeRawUnsafe("SAVEPOINT accounting_unbalanced_header");
      try {
        const bad = await tx.journalEntry.create({
          data: {
            organizationId: org.id,
            code: `${token}-BAD`,
            date: new Date("2026-02-01Z"),
            description: "bad",
            status: "POSTED",
            sourceType: "MANUAL",
            createdById: user.id,
          },
        });
        await expectAccountingFailure(
          tx,
          async () => {
            await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
            return bad;
          },
          /balance|line|posted|constraint/i,
        );
      } finally {
        await tx.$executeRawUnsafe(
          "ROLLBACK TO SAVEPOINT accounting_unbalanced_header",
        );
        await tx.$executeRawUnsafe(
          "RELEASE SAVEPOINT accounting_unbalanced_header",
        );
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
      }

      await expectAccountingFailure(
        tx,
        () =>
          syncSourceJournal(tx, {
            ...sourceInput,
            sourceId: "cross-account",
            lines: [
              { accountKey: "CASH", debit: "1", credit: "0" },
              // The source API maps system keys within its organization; a foreign account is tested at the DB line FK below.
              {
                accountKey: "BANK",
                debit: "0",
                credit: "1",
                projectId: "missing-project",
              },
            ],
          }),
        /project|organization/i,
      );
      const foreignAccount = otherChart.get("CASH");
      assert.ok(foreignAccount);
      const scopeCheckDraft = await tx.journalEntry.create({
        data: {
          organizationId: org.id,
          code: `${token}-SCOPE`,
          date: new Date("2026-02-01Z"),
          description: "scope check",
          status: "DRAFT",
          sourceType: "MANUAL",
          createdById: user.id,
        },
      });
      await expectAccountingFailure(
        tx,
        () =>
          tx.journalLine.create({
            data: {
              organizationId: org.id,
              journalEntryId: scopeCheckDraft.id,
              accountId: foreignAccount.id,
              debit: "1",
              credit: "0",
            },
          }),
        /foreign key|organization|constraint/i,
      );

      const noManage = {
        ...ctx,
        isAdmin: false,
        permissions: new Set(["journal.create"]),
      } as OrgContext;
      await expectAccountingFailure(
        tx,
        () =>
          saveAccount(tx, noManage, {
            code: "X",
            name: "Denied",
            type: "ASSET",
            active: true,
          }),
        /permission/i,
      );
      await expectAccountingFailure(
        tx,
        () =>
          saveJournal(tx, noManage, {
            date: "2026-03-01",
            description: "Denied",
            lines: [],
          } as never),
        /permission|line/i,
      );
      const protectedTemplate = await saveTemplate(tx, ctx, {
        code: "T1",
        name: "Owner template",
        type: "ASSET",
        active: true,
      });
      await expectAccountingFailure(
        tx,
        () =>
          saveTemplate(
            tx,
            {
              ...ctx,
              user: memberUser,
              isAdmin: false,
              permissions: new Set(["accounting.manage"]),
            } as OrgContext,
            {
              id: protectedTemplate.id,
              code: "T1",
              name: "Member edit",
              type: "ASSET",
              active: true,
            },
          ),
        /owner|administrator/i,
      );
      await expectAccountingFailure(
        tx,
        () =>
          saveAccount(tx, ctx, {
            id: chart.get("CASH")?.id ?? "missing-cash",
            code: "1000",
            name: "Changed",
            type: "ASSET",
            active: false,
          }),
        /system accounts/i,
      );
      const custom = await saveAccount(tx, ctx, {
        code: "9000",
        name: "Custom expense",
        type: "EXPENSE",
        active: true,
      });

      const draft = await saveJournal(tx, ctx, {
        date: "2026-03-01",
        description: "Manual",
        lines: [
          {
            accountId: custom.id,
            description: "cost",
            debit: "10",
            credit: "0",
            projectId: null,
            partyId: null,
          },
          {
            accountId: chart.get("CASH")?.id ?? "missing-cash",
            description: "cash",
            debit: "0",
            credit: "10",
            projectId: null,
            partyId: null,
          },
        ],
      });
      const ownerOnlyDraftCtx = {
        ...ctx,
        user: memberUser,
        isAdmin: false,
        permissions: new Set(["journal.create"]),
      } as OrgContext;
      await expectAccountingFailure(
        tx,
        () =>
          saveJournal(tx, ownerOnlyDraftCtx, {
            id: draft.id,
            date: "2026-03-01",
            description: "other owner",
            lines: [
              {
                accountId: custom.id,
                description: "cost",
                debit: "10",
                credit: "0",
                projectId: null,
                partyId: null,
              },
              {
                accountId: chart.get("CASH")?.id ?? "missing-cash",
                description: "cash",
                debit: "0",
                credit: "10",
                projectId: null,
                partyId: null,
              },
            ],
          }),
        /own manual drafts/i,
      );
      const predateFixture = await tx.journalEntry.create({
        data: {
          organizationId: org.id,
          code: `${token}-PREDATE`,
          date: new Date("2026-02-15T00:00:00.000Z"),
          description: "Manual journal for reversal date validation",
          status: "DRAFT",
          sourceType: "MANUAL",
          createdById: user.id,
        },
      });
      await tx.journalLine.createMany({
        data: [
          {
            organizationId: org.id,
            journalEntryId: predateFixture.id,
            accountId: custom.id,
            debit: "10",
            credit: "0",
          },
          {
            organizationId: org.id,
            journalEntryId: predateFixture.id,
            accountId: chart.get("CASH")?.id ?? "missing-cash",
            debit: "0",
            credit: "10",
          },
        ],
      });
      await tx.journalEntry.update({
        where: { id: predateFixture.id },
        data: { status: "POSTED" },
      });
      await expectAccountingFailure(
        tx,
        () =>
          reverseJournal(tx, ctx, {
            id: predateFixture.id,
            date: "2026-01-09",
            reason: "too early",
          }),
        /predate/i,
      );
      await expectAccountingFailure(
        tx,
        () =>
          reverseJournal(tx, ctx, {
            id: original.id,
            date: "2026-01-10",
            reason: "automatic",
          }),
        /manual/i,
      );

      const { verifyJournalApprovalCallbacks } = await import(
        "./newledger-test-fixtures"
      );
      await verifyJournalApprovalCallbacks(tx, {
        token,
        org,
        user,
        custom,
        chart,
      });
      await expectAccountingFailure(
        tx,
        () =>
          saveAccount(tx, ctx, {
            id: custom.id,
            code: custom.code,
            name: custom.name,
            type: "ASSET",
            active: true,
          }),
        /posted activity/i,
      );

      // A zero base-cost entry synchronizes to no active journal; changing a previously nonzero source to zero reverses once.
      const project = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "COST",
          name: "Cost project",
          currency: "INR",
        },
      });
      const cost = await tx.costEntry.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          sourceType: "EXPENSE",
          sourceId: "zero-cost",
          costType: "OTHER",
          description: "zero",
          date: new Date("2026-05-01Z"),
          amount: "10",
          originalAmount: "10",
          originalCurrency: "INR",
          baseAmount: "10",
          exchangeRate: "1",
          createdById: user.id,
        },
      });
      assert.ok(await syncCostEntryJournal(tx, cost, user.id));
      const zeroCost = await tx.costEntry.update({
        where: { id: cost.id },
        data: { amount: "0", originalAmount: "0", baseAmount: "0" },
      });
      assert.equal(await syncCostEntryJournal(tx, zeroCost, user.id), null);
      assert.equal(
        await syncCostEntryJournal(tx, zeroCost, user.id),
        null,
        "zero-cost retries are no-ops after reversal",
      );
      assert.equal(
        await tx.journalEntry.count({
          where: {
            sourceType: "COST_ENTRY",
            sourceDocumentId: cost.id,
            status: "POSTED",
          },
        }),
        2,
      );
    });
  },
);
