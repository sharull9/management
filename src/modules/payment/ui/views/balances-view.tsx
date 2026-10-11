import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { partyBalances } from "../../server/balances";
import { financeData } from "../../server/queries";
import { FinanceFilters } from "../components/finance-filters";
import { AgingTable, BalancesTable } from "../components/finance-tables";
import { ProjectFilter } from "../components/project-filter";
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
  return (
    <div className="space-y-6">
      <PageHeading
        title="Party balances"
        description="Net position is receivables minus payables, plus vendor advances minus customer advances. Currencies remain separate."
      />
      <FinanceFilters
        fields={[
          {
            name: "type",
            label: "Party type",
            value: type ?? null,
            options: [
              { value: "vendor", label: "Vendors" },
              { value: "customer", label: "Customers" },
            ],
            clearable: true,
            placeholder: "Vendors and customers",
          },
        ]}
      />
      <ProjectFilter
        org={org}
        projects={d.projects.map((p) => ({ id: p.id, name: p.name }))}
        projectId={projectId}
      />
      <BalancesTable
        org={org}
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
        }))}
      />
      <FormCard title="Outstanding aging by due date">
        <p className="mb-4 text-sm text-muted-foreground">
          Current includes undated and future-due documents. Buckets show days
          past due.
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
              current: money(a.values.current),
              "0\u201330": money(a.values["0\u201330"]),
              "31\u201360": money(a.values["31\u201360"]),
              "61\u201390": money(a.values["61\u201390"]),
              "90+": money(a.values["90+"]),
            })),
          )}
        />
      </FormCard>
    </div>
  );
}
