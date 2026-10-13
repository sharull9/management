import { PageHeading } from "@/components/shared/page-heading";
import { StatTiles } from "@/components/shared/stat-tiles";
import { UrlTabs } from "@/components/shared/url-tabs";
import { formatMoney } from "@/core/format";
import { Decimal } from "../../server/allocation";
import { partyBalances } from "../../server/balances";
import { financeData } from "../../server/queries";
import { FinanceFilters } from "../components/finance-filters";
import { AgingTable, BalancesTable } from "../components/finance-tables";
import { money } from "../util";
export async function BalancesPage({
  org,
  projectId,
  type,
}: {
  org: string;
  projectId?: string;
  type?: string;
}) {
  const d = await financeData(org, "payment.view", projectId),
    balances = partyBalances(d, undefined, type);
  const sum = (key: "basePayable" | "baseReceivable" | "baseNet") =>
    balances.reduce((v, b) => v.add(b[key]), new Decimal(0));
  return (
    <div className="space-y-6">
      <PageHeading
        title="Party balances"
        description="Net position is receivables minus payables, plus vendor advances minus customer advances. Each row stays in its document currency; base columns convert at each document's own rate."
      />
      <StatTiles
        stats={[
          {
            label: `Payable (${d.baseCurrency.code})`,
            value: formatMoney(sum("basePayable"), d.baseCurrency.code),
          },
          {
            label: `Receivable (${d.baseCurrency.code})`,
            value: formatMoney(sum("baseReceivable"), d.baseCurrency.code),
          },
          {
            label: `Net (${d.baseCurrency.code})`,
            value: formatMoney(sum("baseNet"), d.baseCurrency.code),
            detail: "All currencies, at document rates",
          },
        ]}
      />
      <UrlTabs
        tabs={[
          {
            value: "balances",
            label: "Balances",
            count: balances.length,
            content: (
              <BalancesTable
                org={org}
                toolbar={
                  <FinanceFilters
                    org={org}
                    projects={d.projects.map((p) => ({
                      id: p.id,
                      name: p.name,
                    }))}
                    fields={[
                      {
                        name: "type",
                        label: "Party type",
                        multiple: true,
                        options: [
                          { value: "vendor", label: "Vendors" },
                          { value: "customer", label: "Customers" },
                        ],
                      },
                    ]}
                  />
                }
                projectId={projectId}
                data={balances.map((b) => ({
                  id: `${b.party.id}:${b.currency}`,
                  partyId: b.party.id,
                  party: b.party.displayName,
                  type: `${b.party.isVendor ? "Vendor " : ""}${b.party.isCustomer ? "Customer" : ""}`,
                  currency: b.currency,
                  billed: money(b.billed),
                  paid: money(b.paid),
                  payable: money(b.payable),
                  invoiced: money(b.invoiced),
                  received: money(b.received),
                  receivable: money(b.receivable),
                  outgoingAdvance: money(b.outgoingAdvance),
                  incomingAdvance: money(b.incomingAdvance),
                  net: money(b.net),
                  baseNet: money(b.baseNet),
                }))}
              />
            ),
          },
          {
            value: "aging",
            label: "Aging",
            content: (
              <>
                <p className="text-sm text-muted-foreground">
                  Current includes undated and future-due documents. Buckets
                  show days past due.
                </p>
                <AgingTable
                  data={balances.flatMap((b) =>
                    [
                      { side: "Payable", values: b.payableAging },
                      { side: "Receivable", values: b.receivableAging },
                    ].map((a) => ({
                      id: `${b.party.id}:${b.currency}:${a.side}`,
                      party: `${b.party.displayName} | ${b.currency}`,
                      side: a.side,
                      total: money(
                        a.side === "Payable" ? b.basePayable : b.baseReceivable,
                      ),
                      current: money(a.values.current),
                      "0\u201330": money(a.values["0\u201330"]),
                      "31\u201360": money(a.values["31\u201360"]),
                      "61\u201390": money(a.values["61\u201390"]),
                      "90+": money(a.values["90+"]),
                    })),
                  )}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
