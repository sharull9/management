import { Decimal } from "@/core/decimal";

type DecimalValue = InstanceType<typeof Decimal>;

export type ReportLine = {
  id: string;
  debit: DecimalValue | string;
  credit: DecimalValue | string;
  taxComponentId: string | null;
  taxName: string | null;
  taxRate: DecimalValue | string | null;
  taxBaseAmount: DecimalValue | string | null;
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    systemKey: string | null;
  };
  journalEntry: { id: string; code: string; date: Date; description: string };
};
export type AccountReportTotals = {
  openingDebit: DecimalValue | string;
  openingCredit: DecimalValue | string;
  periodDebit: DecimalValue | string;
  periodCredit: DecimalValue | string;
  throughDebit: DecimalValue | string;
  throughCredit: DecimalValue | string;
};
export const amount = (value: DecimalValue | string) =>
  new Decimal(String(value));
export const text = (value: DecimalValue) => value.toFixed(2);
export const normalBalance = (
  type: string,
  debit: DecimalValue,
  credit: DecimalValue,
) =>
  ["ASSET", "EXPENSE"].includes(type) ? debit.sub(credit) : credit.sub(debit);

export function buildReports(input: {
  accounts: ReportLine["account"][];
  lines: ReportLine[];
  from?: Date;
  to?: Date;
  accountId?: string;
  totalsByAccount?: Map<string, AccountReportTotals>;
  ledgerOpeningBalance?: DecimalValue | string;
  ledgerRowStartingBalance?: DecimalValue | string;
}) {
  const lines = input.lines;
  const inRange = (date: Date) =>
    (!input.from || date >= input.from) && (!input.to || date <= input.to);
  const throughTo = (date: Date) => !input.to || date <= input.to;
  const zero = () => new Decimal(0);
  const sums = new Map<
    string,
    {
      openingDebit: DecimalValue;
      openingCredit: DecimalValue;
      periodDebit: DecimalValue;
      periodCredit: DecimalValue;
    }
  >();
  for (const account of input.accounts)
    sums.set(account.id, {
      openingDebit: zero(),
      openingCredit: zero(),
      periodDebit: zero(),
      periodCredit: zero(),
    });
  for (const line of lines) {
    const item = sums.get(line.account.id);
    if (!item) continue;
    const debit = amount(line.debit),
      credit = amount(line.credit);
    if (input.from && line.journalEntry.date < input.from) {
      item.openingDebit = item.openingDebit.add(debit);
      item.openingCredit = item.openingCredit.add(credit);
    } else if (inRange(line.journalEntry.date)) {
      item.periodDebit = item.periodDebit.add(debit);
      item.periodCredit = item.periodCredit.add(credit);
    }
  }
  if (input.totalsByAccount) {
    for (const account of input.accounts) {
      const total = input.totalsByAccount.get(account.id);
      const item = sums.get(account.id);
      if (!total || !item) continue;
      item.openingDebit = amount(total.openingDebit);
      item.openingCredit = amount(total.openingCredit);
      item.periodDebit = amount(total.periodDebit);
      item.periodCredit = amount(total.periodCredit);
    }
  }
  const trialRows = input.accounts.map((account) => {
    const item = sums.get(account.id);
    if (!item) throw new Error("Missing account report totals.");
    const closing = item.openingDebit
      .add(item.periodDebit)
      .sub(item.openingCredit.add(item.periodCredit));
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      openingDebit: text(item.openingDebit),
      openingCredit: text(item.openingCredit),
      periodDebit: text(item.periodDebit),
      periodCredit: text(item.periodCredit),
      closingDebit: text(closing.gt(0) ? closing : zero()),
      closingCredit: text(closing.lt(0) ? closing.abs() : zero()),
    };
  });
  const debitTotal = trialRows.reduce(
    (sum, row) => sum.add(row.closingDebit),
    zero(),
  );
  const creditTotal = trialRows.reduce(
    (sum, row) => sum.add(row.closingCredit),
    zero(),
  );
  const total = (rows: { amount: string }[]) =>
    rows.reduce((sum, row) => sum.add(row.amount), zero());
  const category = (type: string) =>
    input.accounts
      .filter((a) => a.type === type)
      .map((a) => {
        const relevant = sums.get(a.id);
        const debit = input.totalsByAccount
          ? amount(relevant?.periodDebit ?? "0")
          : lines.reduce(
              (sum, line) =>
                sum.add(
                  line.account.id === a.id && inRange(line.journalEntry.date)
                    ? amount(line.debit)
                    : zero(),
                ),
              zero(),
            );
        const credit = input.totalsByAccount
          ? amount(relevant?.periodCredit ?? "0")
          : lines.reduce(
              (sum, line) =>
                sum.add(
                  line.account.id === a.id && inRange(line.journalEntry.date)
                    ? amount(line.credit)
                    : zero(),
                ),
              zero(),
            );
        return {
          accountId: a.id,
          code: a.code,
          name: a.name,
          amount: text(normalBalance(type, debit, credit)),
        };
      });
  const income = category("INCOME"),
    expenses = category("EXPENSE");
  const totalIncome = total(income),
    totalExpenses = total(expenses);
  const bsCategory = (type: string) =>
    input.accounts
      .filter((a) => a.type === type)
      .map((a) => {
        const debit = input.totalsByAccount
          ? amount(input.totalsByAccount.get(a.id)?.throughDebit ?? "0")
          : lines.reduce(
              (sum, line) =>
                sum.add(
                  line.account.id === a.id && throughTo(line.journalEntry.date)
                    ? amount(line.debit)
                    : zero(),
                ),
              zero(),
            );
        const credit = input.totalsByAccount
          ? amount(input.totalsByAccount.get(a.id)?.throughCredit ?? "0")
          : lines.reduce(
              (sum, line) =>
                sum.add(
                  line.account.id === a.id && throughTo(line.journalEntry.date)
                    ? amount(line.credit)
                    : zero(),
                ),
              zero(),
            );
        return {
          accountId: a.id,
          code: a.code,
          name: a.name,
          amount: text(normalBalance(type, debit, credit)),
        };
      });
  const assets = bsCategory("ASSET"),
    liabilities = bsCategory("LIABILITY"),
    equity = bsCategory("EQUITY");
  const totalAssets = total(assets),
    totalLiabilities = total(liabilities),
    equityBeforeProfit = total(equity);
  const pnlThroughTo = input.accounts
    .filter((a) => ["INCOME", "EXPENSE"].includes(a.type))
    .map((a) => {
      const relevant = input.totalsByAccount?.get(a.id);
      const balance = normalBalance(
        a.type,
        relevant
          ? amount(relevant.throughDebit)
          : lines.reduce(
              (sum, l) =>
                sum.add(
                  l.account.id === a.id && throughTo(l.journalEntry.date)
                    ? amount(l.debit)
                    : zero(),
                ),
              zero(),
            ),
        relevant
          ? amount(relevant.throughCredit)
          : lines.reduce(
              (sum, l) =>
                sum.add(
                  l.account.id === a.id && throughTo(l.journalEntry.date)
                    ? amount(l.credit)
                    : zero(),
                ),
              zero(),
            ),
      );
      return a.type === "INCOME" ? balance : balance.negated();
    })
    .reduce((sum, value) => sum.add(value), zero());
  const retainedProfit = pnlThroughTo,
    totalEquity = equityBeforeProfit.add(retainedProfit);
  const ledgerAccount = input.accountId
    ? input.accounts.find((a) => a.id === input.accountId)
    : (input.accounts.find((a) => lines.some((l) => l.account.id === a.id)) ??
      input.accounts[0]);
  const accountLines = ledgerAccount
    ? lines.filter((l) => l.account.id === ledgerAccount.id)
    : [];
  if (!input.totalsByAccount)
    accountLines.sort(
      (a, b) =>
        a.journalEntry.date.getTime() - b.journalEntry.date.getTime() ||
        a.journalEntry.code.localeCompare(b.journalEntry.code) ||
        a.id.localeCompare(b.id),
    );
  const openingLines = accountLines.filter(
    (l) => input.from && l.journalEntry.date < input.from,
  );
  let balance =
    input.ledgerRowStartingBalance !== undefined
      ? amount(input.ledgerRowStartingBalance)
      : input.ledgerOpeningBalance !== undefined
        ? amount(input.ledgerOpeningBalance)
        : ledgerAccount
          ? normalBalance(
              ledgerAccount.type,
              openingLines.reduce((s, l) => s.add(amount(l.debit)), zero()),
              openingLines.reduce((s, l) => s.add(amount(l.credit)), zero()),
            )
          : zero();
  const openingBalance = text(
    input.ledgerOpeningBalance !== undefined
      ? amount(input.ledgerOpeningBalance)
      : balance,
  );
  const ledgerRows = accountLines
    .filter((l) => inRange(l.journalEntry.date))
    .map((l) => {
      const debit = amount(l.debit),
        credit = amount(l.credit);
      balance = balance.add(
        normalBalance(ledgerAccount?.type ?? "ASSET", debit, credit),
      );
      return {
        id: l.id,
        journalId: l.journalEntry.id,
        code: l.journalEntry.code,
        date: l.journalEntry.date.toISOString().slice(0, 10),
        description: l.journalEntry.description,
        debit: text(debit),
        credit: text(credit),
        balance: text(balance),
      };
    });
  const taxGroups = new Map<
    string,
    {
      key: string;
      name: string;
      rate: string | null;
      accountKey: string | null;
      base: DecimalValue;
      debit: DecimalValue;
      credit: DecimalValue;
    }
  >();
  for (const l of lines.filter(
    (item) => item.taxComponentId && inRange(item.journalEntry.date),
  )) {
    if (!l.taxComponentId) continue;
    const rate = l.taxRate == null ? null : String(l.taxRate);
    const key = [l.taxComponentId, l.taxName, rate, l.account.systemKey].join(
      "|",
    );
    const row = taxGroups.get(key) ?? {
      key,
      name: l.taxName ?? "Tax",
      rate,
      accountKey: l.account.systemKey,
      base: zero(),
      debit: zero(),
      credit: zero(),
    };
    row.base = row.base.add(
      l.taxBaseAmount == null ? 0 : amount(l.taxBaseAmount),
    );
    row.debit = row.debit.add(amount(l.debit));
    row.credit = row.credit.add(amount(l.credit));
    taxGroups.set(key, row);
  }
  const taxRows = [...taxGroups.values()].map((r) => ({
    key: r.key,
    name: r.name,
    rate: r.rate,
    accountKey: r.accountKey,
    baseAmount: text(r.base),
    debit: text(r.debit),
    credit: text(r.credit),
    net: text(r.debit.sub(r.credit)),
  }));
  return {
    trialBalance: {
      rows: trialRows,
      debitTotal: text(debitTotal),
      creditTotal: text(creditTotal),
      difference: text(debitTotal.sub(creditTotal)),
    },
    profitLoss: {
      income,
      expenses,
      totalIncome: text(totalIncome),
      totalExpenses: text(totalExpenses),
      netProfit: text(totalIncome.sub(totalExpenses)),
    },
    balanceSheet: {
      assets,
      liabilities,
      equity,
      totalAssets: text(totalAssets),
      totalLiabilities: text(totalLiabilities),
      equityBeforeProfit: text(equityBeforeProfit),
      retainedProfit: text(retainedProfit),
      totalEquity: text(totalEquity),
      difference: text(totalAssets.sub(totalLiabilities).sub(totalEquity)),
    },
    ledger: {
      accountId: ledgerAccount?.id ?? null,
      openingBalance,
      rows: ledgerRows,
      closingBalance: text(balance),
    },
    tax: {
      rows: taxRows,
      totalDebit: text(taxRows.reduce((s, r) => s.add(r.debit), zero())),
      totalCredit: text(taxRows.reduce((s, r) => s.add(r.credit), zero())),
    },
  };
}
