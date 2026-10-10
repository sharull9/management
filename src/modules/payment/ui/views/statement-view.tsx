import { notFound } from "next/navigation";
import { SelectField } from "@/components/shared/fields";
import { PageHeading } from "@/components/shared/page-heading";
import { Decimal } from "../../server/allocation";
import { financeData } from "../../server/queries";

import { partyStatement } from "../../server/statement";
import { date } from "../util";
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
  const selected =
    currency && currencies.includes(currency)
      ? currency
      : (currencies[0] ?? d.ctx.org.baseCurrency);
  const entries = partyStatement(d, partyId, selected);
  return (
    <div className="space-y-6">
      <PageHeading
        title={`${party.displayName} statement`}
        description={`Chronological activity in ${selected}. Positive balance is due from the party; negative balance is due to the party. Allocations do not change the net position.`}
      />
      <form className="flex max-w-sm items-end gap-3">
        <input type="hidden" name="projectId" value={projectId ?? ""} />
        <SelectField label="Currency" name="currency" defaultValue={selected}>
          {(currencies.length ? currencies : [selected]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <button className="rounded-md border px-4 py-2 text-sm" type="submit">
          Show
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {["Date", "Activity", "Debit", "Credit", "Running balance"].map(
                (h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{date(e.date)}</td>
                <td className="p-3">{e.description}</td>
                <td className="p-3">{new Decimal(e.debit).toFixed(2)}</td>
                <td className="p-3">{new Decimal(e.credit).toFixed(2)}</td>
                <td className="p-3 tabular-nums">{e.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && (
          <p className="p-6 text-sm text-muted-foreground">No activity.</p>
        )}
      </div>
    </div>
  );
}
