import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import {
  assertBaseCurrencyChangeAllowed,
  baseCurrencyLockReasons,
  countBaseCurrencyUsage,
} from "./base-currency";

const tables = [
  "costEntry",
  "stockMovement",
  "purchaseOrder",
  "goodsReceipt",
  "vendorBill",
  "paymentRequest",
  "salesInvoice",
  "payment",
  "expense",
  "asset",
  "journalEntry",
  "exchangeRate",
] as const;

function fakeTx(counts: Partial<Record<(typeof tables)[number], number>>) {
  const where: Record<string, unknown> = {};
  const tx = Object.fromEntries(
    tables.map((name) => [
      name,
      {
        count: async (args: { where: unknown }) => {
          where[name] = args.where;
          return counts[name] ?? 0;
        },
      },
    ]),
  );
  return { tx: tx as unknown as Prisma.TransactionClient, where };
}

test("an organization with no postings may change its base currency", async () => {
  const { tx } = fakeTx({});
  await assertBaseCurrencyChangeAllowed(tx, "org1");
});

test("cost entries, stock, posted documents and rates each lock the base currency", async () => {
  for (const table of tables) {
    const { tx } = fakeTx({ [table]: 2 });
    await assert.rejects(
      assertBaseCurrencyChangeAllowed(tx, "org1"),
      /base currency cannot be changed/,
      table,
    );
  }
});

test("usage counts only non-draft documents and scopes to the organization", async () => {
  const { tx, where } = fakeTx({ vendorBill: 1, expense: 3 });
  const usage = await countBaseCurrencyUsage(tx, "org1");
  assert.equal(usage.documents, 4);
  assert.deepEqual(where.vendorBill, {
    organizationId: "org1",
    status: { not: "DRAFT" },
  });
  assert.deepEqual(where.expense, { project: { organizationId: "org1" } });
  assert.deepEqual(where.costEntry, { organizationId: "org1" });
});

test("lock reasons list every blocker", () => {
  assert.deepEqual(
    baseCurrencyLockReasons({
      costEntries: 0,
      stockMovements: 0,
      documents: 0,
      exchangeRates: 0,
    }),
    [],
  );
  assert.equal(
    baseCurrencyLockReasons({
      costEntries: 1,
      stockMovements: 2,
      documents: 3,
      exchangeRates: 4,
    }).length,
    4,
  );
});
