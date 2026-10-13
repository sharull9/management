import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { costEntryAmounts } from "./cost-entry";
import { resolveProjectRate, resolveRate } from "./rates";

type Rate = { currencyCode: string; rateDate: string; rate: string };

function fakeTx(options: {
  base?: { code: string; decimals: number };
  project?: { code: string; decimals: number };
  rates?: Rate[];
}) {
  const base = options.base ?? { code: "INR", decimals: 2 };
  const project = options.project ?? base;
  const rates = options.rates ?? [];
  const tx = {
    organization: {
      findUniqueOrThrow: async () => ({ baseCurrencyRef: base }),
    },
    project: {
      findFirstOrThrow: async () => ({
        currency: project.code,
        currencyRef: project,
      }),
    },
    exchangeRate: {
      findFirst: async (args: {
        where: { currencyCode: string; rateDate: { lte: Date } };
      }) => {
        const found = rates
          .filter(
            (r) =>
              r.currencyCode === args.where.currencyCode &&
              new Date(`${r.rateDate}T00:00:00Z`) <= args.where.rateDate.lte,
          )
          .sort((a, b) => b.rateDate.localeCompare(a.rateDate))[0];
        return found ? { rate: found.rate } : null;
      },
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

const usd: Rate[] = [
  { currencyCode: "USD", rateDate: "2026-10-01", rate: "83.1" },
  { currencyCode: "USD", rateDate: "2026-10-10", rate: "84.25" },
];

test("the base currency resolves to exactly 1 without a lookup", async () => {
  const rate = await resolveRate(fakeTx({}), "org", "INR", "2026-10-13");
  assert.equal(rate.toString(), "1");
});

test("the latest rate on or before the date wins", async () => {
  const tx = fakeTx({ rates: usd });
  assert.equal(
    (await resolveRate(tx, "org", "USD", "2026-10-13")).toString(),
    "84.25",
  );
  assert.equal(
    (await resolveRate(tx, "org", "USD", "2026-10-10")).toString(),
    "84.25",
  );
  assert.equal(
    (await resolveRate(tx, "org", "USD", "2026-10-09")).toString(),
    "83.1",
  );
});

test("a missing rate names the currency and date", async () => {
  const tx = fakeTx({ rates: usd });
  await assert.rejects(
    resolveRate(tx, "org", "USD", new Date("2026-09-30T00:00:00Z")),
    /No USD exchange rate on or before 2026-09-30\. Add one in Settings → Exchange rates\./,
  );
});

test("the project rate follows the project currency", async () => {
  const same = fakeTx({});
  assert.equal(
    (await resolveProjectRate(same, "org", "p", "2026-10-13")).toString(),
    "1",
  );
  const usdProject = fakeTx({
    project: { code: "USD", decimals: 2 },
    rates: usd,
  });
  assert.equal(
    (await resolveProjectRate(usdProject, "org", "p", "2026-10-13")).toString(),
    "84.25",
  );
});

test("cost entries in the base currency keep amount, base and original equal", async () => {
  const tx = fakeTx({});
  const result = await costEntryAmounts(tx, {
    organizationId: "org",
    projectId: "p",
    date: "2026-10-13",
    amount: "1250.50",
  });
  assert.equal(result.originalCurrency, "INR");
  assert.equal(result.amount.toString(), "1250.5");
  assert.equal(result.baseAmount.toString(), "1250.5");
  assert.equal(result.exchangeRate.toString(), "1");
  assert.equal(result.projectRate.toString(), "1");
});

test("a foreign cost in a base-currency project converts at the dated rate", async () => {
  const tx = fakeTx({ rates: usd });
  const result = await costEntryAmounts(tx, {
    organizationId: "org",
    projectId: "p",
    date: "2026-10-13",
    currency: "USD",
    amount: "100",
  });
  assert.equal(result.baseAmount.toString(), "8425");
  assert.equal(result.amount.toString(), "8425");
  assert.equal(result.exchangeRate.toString(), "84.25");
});

test("an explicit rate overrides the lookup and a USD project keeps USD amounts", async () => {
  const tx = fakeTx({ project: { code: "USD", decimals: 2 }, rates: usd });
  const result = await costEntryAmounts(tx, {
    organizationId: "org",
    projectId: "p",
    date: "2026-10-13",
    currency: "USD",
    amount: "100",
    exchangeRate: "85",
  });
  assert.equal(result.amount.toString(), "100");
  assert.equal(result.baseAmount.toString(), "8500");
  assert.equal(result.projectRate.toString(), "85");
});

test("an INR cost in a USD project divides by the project rate", async () => {
  const tx = fakeTx({ project: { code: "USD", decimals: 2 }, rates: usd });
  const result = await costEntryAmounts(tx, {
    organizationId: "org",
    projectId: "p",
    date: "2026-10-13",
    amount: "8425",
  });
  assert.equal(result.amount.toString(), "100");
  assert.equal(result.baseAmount.toString(), "8425");
});
