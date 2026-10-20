import assert from "node:assert/strict";
import test from "node:test";
import { buildReports } from "./report-util";

const cash = {
  id: "cash",
  code: "1000",
  name: "Cash",
  type: "ASSET",
  systemKey: "CASH",
};
const equity = {
  id: "equity",
  code: "3000",
  name: "Equity",
  type: "EQUITY",
  systemKey: "RETAINED_EARNINGS",
};
const sales = {
  id: "sales",
  code: "4000",
  name: "Sales",
  type: "INCOME",
  systemKey: "SALES_REVENUE",
};
const expense = {
  id: "expense",
  code: "5000",
  name: "Expense",
  type: "EXPENSE",
  systemKey: "OTHER_EXPENSE",
};
const accounts = [cash, equity, sales, expense];
const line = (
  id: string,
  account: (typeof accounts)[number],
  date: string,
  debit: string,
  credit: string,
  taxBaseAmount: string | null = null,
) => ({
  id,
  account,
  debit,
  credit,
  taxComponentId: "tax",
  taxName: "VAT",
  taxRate: "10",
  taxBaseAmount,
  journalEntry: {
    id: `j-${id}`,
    code: `J-${id}`,
    date: new Date(`${date}T00:00:00.000Z`),
    description: "entry",
  },
});

test("reports use exact Decimal balances and retained profit ignores the P&L from date", () => {
  const result = buildReports({
    accounts,
    lines: [
      line("open-cash", cash, "2024-12-31", "100", "0"),
      line("opening-equity", equity, "2024-12-31", "0", "100"),
      line("old-sale", sales, "2025-01-10", "0", "80"),
      line("new-sale", sales, "2025-03-10", "0", "40", "400"),
      line("new-expense", expense, "2025-03-15", "10", "0", "100"),
    ],
    from: new Date("2025-03-01T00:00:00.000Z"),
    to: new Date("2025-03-31T00:00:00.000Z"),
  });
  assert.equal(result.profitLoss.netProfit, "30.00");
  assert.equal(result.balanceSheet.retainedProfit, "110.00");
  assert.equal(
    result.trialBalance.rows.find((row) => row.accountId === "cash")
      ?.openingDebit,
    "100.00",
  );
  assert.equal(result.ledger.openingBalance, "100.00");
  assert.equal(
    result.tax.rows.reduce((sum, row) => sum + Number(row.baseAmount), 0),
    500,
  );
});

test("ledger running balance follows normal balance for liabilities", () => {
  const liability = {
    id: "ap",
    code: "2000",
    name: "AP",
    type: "LIABILITY",
    systemKey: "ACCOUNTS_PAYABLE",
  };
  const result = buildReports({
    accounts: [liability],
    lines: [
      line("credit", liability, "2025-01-01", "0", "100"),
      line("debit", liability, "2025-01-02", "25", "0"),
    ],
  });
  assert.deepEqual(
    result.ledger.rows.map((row) => row.balance),
    ["100.00", "75.00"],
  );
  assert.equal(result.trialBalance.rows[0]?.closingDebit, "0.00");
  assert.equal(result.trialBalance.rows[0]?.closingCredit, "75.00");
});

test("trial balance puts credit-normal accounts in the credit column", () => {
  const result = buildReports({
    accounts,
    lines: [
      line("cash", cash, "2026-10-18", "5000", "0"),
      line("capital", equity, "2026-10-18", "0", "5000"),
    ],
  });
  assert.equal(result.trialBalance.debitTotal, "5000.00");
  assert.equal(result.trialBalance.creditTotal, "5000.00");
  assert.equal(result.trialBalance.difference, "0.00");
});

test("aggregated report totals preserve Decimal balances and carry journal IDs", () => {
  const result = buildReports({
    accounts: [cash],
    lines: [line("page-line", cash, "2025-03-02", "0.1", "0")],
    from: new Date("2025-03-01T00:00:00.000Z"),
    to: new Date("2025-03-31T00:00:00.000Z"),
    accountId: cash.id,
    totalsByAccount: new Map([
      [
        cash.id,
        {
          openingDebit: "9007199254740993.01",
          openingCredit: "0",
          periodDebit: "0.1",
          periodCredit: "0",
          throughDebit: "9007199254740993.11",
          throughCredit: "0",
        },
      ],
    ]),
    ledgerOpeningBalance: "9007199254740993.01",
  });
  assert.equal(
    result.trialBalance.rows[0]?.openingDebit,
    "9007199254740993.01",
  );
  assert.equal(result.ledger.rows[0]?.journalId, "j-page-line");
  assert.equal(result.ledger.rows[0]?.balance, "9007199254740993.11");
});
