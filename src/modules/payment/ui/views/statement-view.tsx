import { notFound } from "next/navigation";
import { PageHeading } from "@/components/shared/page-heading";
import { Decimal } from "../../server/allocation";
import { financeData } from "../../server/queries";
import { partyStatement } from "../../server/statement";
import { FinanceFilters } from "../components/finance-filters";
import { StatementTable } from "../components/finance-tables";
export async function StatementPage({
  org,
  partyId,
  currency,
  projectId,
}: {
  org: string;
  partyId: string;
  currency?: string;
  projectId?: string;
}) {
  const d = await financeData(org, "payment.view", projectId),
    party = d.parties.find((p) => p.id === partyId);
  if (!party) notFound();
  const currencies = [
    ...new Set(
      [...d.bills, ...d.invoices, ...d.payments]
        .filter((r) => r.partyId === partyId)
        .map((r) => r.currency),
    ),
  ];
  // Requested currency, else the party's default when it has activity, else the
  // only (or first) currency present.
  const preferred =
    party.defaultCurrency && currencies.includes(party.defaultCurrency)
      ? party.defaultCurrency
      : currencies[0];
  const selected =
    currency && currencies.includes(currency)
      ? currency
      : (preferred ?? party.defaultCurrency ?? d.ctx.org.baseCurrency);
  const entries = partyStatement(d, partyId, selected);
  return (
    <div className="space-y-6">
      <PageHeading
        title={`${party.displayName} statement`}
        description={`Chronological activity in ${selected}. Positive balance is due from the party; negative balance is due to the party. Allocations do not change the net position. Running balances include all activity, even when searching. The base balance values each entry at its own document rate in ${d.baseCurrency.code}.`}
      />
      <StatementTable
        toolbar={
          <FinanceFilters
            org={org}
            projects={d.projects.map((p) => ({ id: p.id, name: p.name }))}
            fields={[
              {
                name: "currency",
                label: "Currency",
                clearable: false,
                fallback: selected,
                options: (currencies.length ? currencies : [selected]).map(
                  (value) => ({ value, label: value }),
                ),
              },
            ]}
          />
        }
        data={entries.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          description: e.description,
          debit: new Decimal(e.debit).toFixed(2),
          credit: new Decimal(e.credit).toFixed(2),
          balance: e.balance,
          baseBalance: e.baseBalance,
        }))}
      />
    </div>
  );
}
