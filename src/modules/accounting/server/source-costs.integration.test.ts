import assert from "node:assert/strict";
import test from "node:test";
import {
  expectBalance,
  postedLines,
  sourceTestBase,
} from "./source-test-fixtures";
import { withAccountingTestDatabase } from "./test-database";

test(
  "accounting cost source adapters ignore operational inventory and safely post supported costs",
  { skip: process.env.ACCOUNTING_DB_TEST !== "local-only" },
  async () => {
    await withAccountingTestDatabase(async (tx) => {
      const { org, user, project } = await sourceTestBase(tx);
      const { syncCostEntryJournal } = await import("./source-costs");
      // Disallowed operational inventory costs never create a second material
      // expense posting; a supported nonzero expense does post once.
      const cost = await tx.costEntry.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          date: new Date("2026-02-02"),
          costType: "MATERIAL",
          amount: 30,
          originalCurrency: "INR",
          originalAmount: 30,
          baseAmount: 30,
          description: "inventory issue shadow",
          sourceType: "CONSUMPTION",
          sourceId: "source-test",
          createdById: user.id,
        },
      });
      assert.equal(await syncCostEntryJournal(tx, cost, user.id), null);
      assert.equal(
        await tx.accountingSource.count({
          where: {
            organizationId: org.id,
            sourceType: "COST_ENTRY",
            sourceId: cost.id,
          },
        }),
        0,
      );
      const expense = await tx.costEntry.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          date: new Date("2026-02-02"),
          costType: "OTHER",
          amount: 0.01,
          originalCurrency: "INR",
          originalAmount: 0.01,
          baseAmount: 0.01,
          description: "approved expense",
          sourceType: "EXPENSE",
          sourceId: "expense-source",
          createdById: user.id,
        },
      });
      await syncCostEntryJournal(tx, expense, user.id);
      const expenseLines = await postedLines(
        tx,
        org.id,
        "COST_ENTRY",
        expense.id,
      );
      expectBalance(expenseLines);
      assert.equal(
        expenseLines.reduce((n, line) => n + Number(line.debit), 0).toFixed(2),
        "0.01",
      );

      // A history snapshot fetched before a delete must re-read under the
      // accounting lock and reverse the source instead of restoring it.
      await tx.costEntry.delete({ where: { id: expense.id } });
      await syncCostEntryJournal(tx, expense, user.id);
      assert.equal(
        (
          await tx.accountingSource.findUniqueOrThrow({
            where: {
              organizationId_sourceType_sourceId: {
                organizationId: org.id,
                sourceType: "COST_ENTRY",
                sourceId: expense.id,
              },
            },
          })
        ).currentEntryId,
        null,
      );

      // A zero base cost does not create an empty source journal or a second
      // material posting; it remains safely retryable.
      const zero = await tx.costEntry.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          date: new Date("2026-02-03"),
          costType: "OTHER",
          amount: 0,
          originalCurrency: "INR",
          originalAmount: 0,
          baseAmount: 0,
          description: "zero",
          sourceType: "EXPENSE",
          sourceId: "zero-source",
          createdById: user.id,
        },
      });
      await syncCostEntryJournal(tx, zero, user.id);
      assert.equal(
        await tx.accountingSource.count({
          where: {
            organizationId: org.id,
            sourceType: "COST_ENTRY",
            sourceId: zero.id,
          },
        }),
        1,
      );
      assert.equal(
        await tx.journalEntry.count({
          where: {
            organizationId: org.id,
            source: { sourceType: "COST_ENTRY", sourceId: zero.id },
          },
        }),
        0,
      );
    });
  },
);
