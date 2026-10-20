import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { ServerPagination } from "@/components/shared/server-pagination";
import { formatMoney } from "@/core/format";
import { reportsData } from "../../server/reports";
import { AccountingTable } from "../components/accounting-table";
import { ReportFilters } from "../components/report-filters";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const filtersFrom = (params: Params) => ({
  from: one(params.from),
  to: one(params.to),
  accountId: one(params.accountId),
});
const currencyAmount = (value: string, currency: string) =>
  formatMoney(value, currency);
const period = (filters: { from?: string; to?: string }) =>
  filters.from || filters.to
    ? `${filters.from ?? "Beginning"} to ${filters.to ?? "Today"}`
    : "All dates";

export async function LedgerView({
  org,
  searchParams = {},
}: {
  org: string;
  searchParams?: Params;
}) {
  const data = await reportsData(org, searchParams);
  const account = data.accounts.find((row) => row.id === data.ledger.accountId);
  const rows = data.ledger.rows.map((row) => ({
    id: row.id,
    journalId: row.journalId,
    date: row.date,
    journal: row.code,
    description: row.description,
    debit: currencyAmount(row.debit, data.ctx.org.baseCurrency),
    credit: currencyAmount(row.credit, data.ctx.org.baseCurrency),
    balance: currencyAmount(row.balance, data.ctx.org.baseCurrency),
  }));
  return (
    <>
      <PageHeading
        title="General ledger"
        description={`${account ? `${account.code} · ${account.name}` : "No accounts"} · ${period(data.filters)} · ${data.ctx.org.baseCurrency}`}
      />
      <ReportFilters
        accounts={data.accounts.map(({ id, code, name }) => ({
          id,
          code,
          name,
        }))}
        accountFilter
      />
      <FormCard
        title="Account activity"
        description={`Opening balance ${currencyAmount(data.ledger.openingBalance, data.ctx.org.baseCurrency)} · Closing balance ${currencyAmount(data.ledger.closingBalance, data.ctx.org.baseCurrency)}`}
      >
        <AccountingTable
          rows={rows}
          columns={[
            { key: "date", label: "Date" },
            { key: "journal", label: "Journal" },
            { key: "description", label: "Description" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
            { key: "balance", label: "Running balance", align: "right" },
          ]}
          href={(row) => `/${org}/accounting/journals/${row.journalId}`}
        />
        <div className="mt-4">
          <ServerPagination
            page={data.ledger.page}
            pageSize={data.ledger.pageSize}
            total={data.ledger.total}
          />
        </div>
      </FormCard>
    </>
  );
}

export async function TrialBalanceView({
  org,
  searchParams = {},
}: {
  org: string;
  searchParams?: Params;
}) {
  const data = await reportsData(
    org,
    filtersFrom(searchParams),
    "trial-balance",
  );
  const rows = data.trialBalance.rows.map((row) => ({
    id: row.accountId,
    code: row.code,
    account: row.name,
    type: row.type,
    openingDebit: currencyAmount(row.openingDebit, data.ctx.org.baseCurrency),
    openingCredit: currencyAmount(row.openingCredit, data.ctx.org.baseCurrency),
    debit: currencyAmount(row.periodDebit, data.ctx.org.baseCurrency),
    credit: currencyAmount(row.periodCredit, data.ctx.org.baseCurrency),
    closingDebit: currencyAmount(row.closingDebit, data.ctx.org.baseCurrency),
    closingCredit: currencyAmount(row.closingCredit, data.ctx.org.baseCurrency),
  }));
  const equal = Number(data.trialBalance.difference) === 0;
  return (
    <>
      <PageHeading
        title="Trial balance"
        description={`${period(data.filters)} · ${data.ctx.org.baseCurrency}`}
      />
      <ReportFilters
        accounts={data.accounts.map(({ id, code, name }) => ({
          id,
          code,
          name,
        }))}
      />
      <FormCard
        title="Balances by account"
        description={`Closing debits ${currencyAmount(data.trialBalance.debitTotal, data.ctx.org.baseCurrency)} · closing credits ${currencyAmount(data.trialBalance.creditTotal, data.ctx.org.baseCurrency)} · ${equal ? "In balance" : `Difference ${currencyAmount(data.trialBalance.difference, data.ctx.org.baseCurrency)}`}`}
      >
        <AccountingTable
          rows={rows}
          empty="No accounts have been initialized yet."
          columns={[
            { key: "code", label: "Code" },
            { key: "account", label: "Account" },
            { key: "type", label: "Type" },
            { key: "openingDebit", label: "Opening debit", align: "right" },
            { key: "openingCredit", label: "Opening credit", align: "right" },
            { key: "debit", label: "Period debit", align: "right" },
            { key: "credit", label: "Period credit", align: "right" },
            { key: "closingDebit", label: "Closing debit", align: "right" },
            { key: "closingCredit", label: "Closing credit", align: "right" },
          ]}
        />
      </FormCard>
    </>
  );
}

export async function ProfitLossView({
  org,
  searchParams = {},
}: {
  org: string;
  searchParams?: Params;
}) {
  const data = await reportsData(org, filtersFrom(searchParams), "profit-loss");
  const rows = [
    ...data.profitLoss.income
      .filter((row) => Number(row.amount) !== 0)
      .map((row) => ({
        id: row.accountId,
        code: row.code,
        account: row.name,
        kind: "Income",
        amount: currencyAmount(row.amount, data.ctx.org.baseCurrency),
      })),
    ...data.profitLoss.expenses
      .filter((row) => Number(row.amount) !== 0)
      .map((row) => ({
        id: row.accountId,
        code: row.code,
        account: row.name,
        kind: "Expense",
        amount: currencyAmount(row.amount, data.ctx.org.baseCurrency),
      })),
  ];
  return (
    <>
      <PageHeading
        title="Profit and loss"
        description={`${period(data.filters)} · ${data.ctx.org.baseCurrency}`}
      />
      <ReportFilters
        accounts={data.accounts.map(({ id, code, name }) => ({
          id,
          code,
          name,
        }))}
      />
      <FormCard
        title="Income and expenses"
        description={`Income ${currencyAmount(data.profitLoss.totalIncome, data.ctx.org.baseCurrency)} · Expenses ${currencyAmount(data.profitLoss.totalExpenses, data.ctx.org.baseCurrency)} · Net profit ${currencyAmount(data.profitLoss.netProfit, data.ctx.org.baseCurrency)}`}
      >
        <AccountingTable
          rows={rows}
          columns={[
            { key: "code", label: "Code" },
            { key: "account", label: "Account" },
            { key: "kind", label: "Type" },
            { key: "amount", label: "Amount", align: "right" },
          ]}
          empty="No income or expense postings for this period."
        />
      </FormCard>
    </>
  );
}

export async function BalanceSheetView({
  org,
  searchParams = {},
}: {
  org: string;
  searchParams?: Params;
}) {
  const data = await reportsData(
    org,
    filtersFrom(searchParams),
    "balance-sheet",
  );
  const rows = [
    ...data.balanceSheet.assets
      .filter((r) => Number(r.amount) !== 0)
      .map((r) => ({
        id: r.accountId,
        code: r.code,
        account: r.name,
        kind: "Asset",
        amount: currencyAmount(r.amount, data.ctx.org.baseCurrency),
      })),
    ...data.balanceSheet.liabilities
      .filter((r) => Number(r.amount) !== 0)
      .map((r) => ({
        id: r.accountId,
        code: r.code,
        account: r.name,
        kind: "Liability",
        amount: currencyAmount(r.amount, data.ctx.org.baseCurrency),
      })),
    ...data.balanceSheet.equity
      .filter((r) => Number(r.amount) !== 0)
      .map((r) => ({
        id: r.accountId,
        code: r.code,
        account: r.name,
        kind: "Equity",
        amount: currencyAmount(r.amount, data.ctx.org.baseCurrency),
      })),
    ...(Number(data.balanceSheet.retainedProfit) !== 0
      ? [
          {
            id: "retained-profit",
            code: "",
            account: "Retained profit",
            kind: "Equity",
            amount: currencyAmount(
              data.balanceSheet.retainedProfit,
              data.ctx.org.baseCurrency,
            ),
          },
        ]
      : []),
  ];
  const equal = Number(data.balanceSheet.difference) === 0;
  return (
    <>
      <PageHeading
        title="Balance sheet"
        description={`As of ${data.filters.to ?? "today"} · ${data.ctx.org.baseCurrency}`}
      />
      <ReportFilters
        accounts={data.accounts.map(({ id, code, name }) => ({
          id,
          code,
          name,
        }))}
      />
      <FormCard
        title="Assets, liabilities and equity"
        description={`Assets ${currencyAmount(data.balanceSheet.totalAssets, data.ctx.org.baseCurrency)} · liabilities ${currencyAmount(data.balanceSheet.totalLiabilities, data.ctx.org.baseCurrency)} · equity ${currencyAmount(data.balanceSheet.totalEquity, data.ctx.org.baseCurrency)} · ${equal ? "Balanced" : `Difference ${currencyAmount(data.balanceSheet.difference, data.ctx.org.baseCurrency)}`}`}
      >
        <AccountingTable
          rows={rows}
          columns={[
            { key: "code", label: "Code" },
            { key: "account", label: "Account" },
            { key: "kind", label: "Type" },
            { key: "amount", label: "Balance", align: "right" },
          ]}
          empty="No balance sheet accounts have activity."
        />
      </FormCard>
    </>
  );
}

export async function TaxView({
  org,
  searchParams = {},
}: {
  org: string;
  searchParams?: Params;
}) {
  const data = await reportsData(org, filtersFrom(searchParams), "tax");
  const rows = data.tax.rows.map((r, index) => ({
    id: `${r.key}-${r.accountKey}-${index}`,
    component: r.name,
    rate: r.rate ? `${r.rate}%` : "—",
    account: r.accountKey ?? "—",
    base: currencyAmount(r.baseAmount, data.ctx.org.baseCurrency),
    debit: currencyAmount(r.debit, data.ctx.org.baseCurrency),
    credit: currencyAmount(r.credit, data.ctx.org.baseCurrency),
    net: currencyAmount(r.net, data.ctx.org.baseCurrency),
  }));
  return (
    <>
      <PageHeading
        title="Tax summary"
        description={`${period(data.filters)} · ${data.ctx.org.baseCurrency}. Posted tax snapshots grouped by component and account.`}
      />
      <ReportFilters
        accounts={data.accounts.map(({ id, code, name }) => ({
          id,
          code,
          name,
        }))}
      />
      <FormCard title="Posted tax amounts">
        <AccountingTable
          rows={rows}
          columns={[
            { key: "component", label: "Component" },
            { key: "rate", label: "Rate" },
            { key: "account", label: "Account" },
            { key: "base", label: "Tax base", align: "right" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
            { key: "net", label: "Net", align: "right" },
          ]}
          empty="No posted lines have tax snapshots for this period."
        />
      </FormCard>
    </>
  );
}
