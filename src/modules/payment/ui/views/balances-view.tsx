import Link from "next/link";
import { SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { partyBalances } from "../../server/balances";
import { financeData } from "../../server/queries";
import { linkClass, money } from "../util";
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
      <form className="grid max-w-xl gap-3 sm:grid-cols-3">
        <SelectField label="Party type" name="type" defaultValue={type ?? ""}>
          <option value="">Vendors and customers</option>
          <option value="vendor">Vendors</option>
          <option value="customer">Customers</option>
        </SelectField>
        <SelectField
          label="Project"
          name="projectId"
          defaultValue={projectId ?? ""}
        >
          <option value="">All accessible projects</option>
          {d.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <button
          type="submit"
          className="self-end rounded-md border px-4 py-2 text-sm"
        >
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Party",
                "Currency",
                "Billed",
                "Paid",
                "Payable",
                "Invoiced",
                "Received",
                "Receivable",
                "Vendor advance",
                "Customer advance",
                "Net",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={`${b.party.id}:${b.currency}`} className="border-t">
                <td className="p-3">
                  <Link
                    className={linkClass}
                    href={`/${org}/finance/balances/${b.party.id}?currency=${b.currency}${projectId ? `&projectId=${projectId}` : ""}`}
                  >
                    {b.party.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {b.party.isVendor ? "Vendor " : ""}
                    {b.party.isCustomer ? "Customer" : ""}
                  </p>
                </td>
                <td className="p-3">{b.currency}</td>
                {[
                  b.billed,
                  b.paid,
                  b.payable,
                  b.invoiced,
                  b.received,
                  b.receivable,
                  b.outgoingAdvance,
                  b.incomingAdvance,
                  b.net,
                ].map((v, i) => (
                  <td
                    key={
                      [
                        "billed",
                        "paid",
                        "payable",
                        "invoiced",
                        "received",
                        "receivable",
                        "vendorAdvance",
                        "customerAdvance",
                        "net",
                      ][i]
                    }
                    className="p-3 tabular-nums"
                  >
                    {money(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!balances.length && (
          <p className="p-6 text-sm text-muted-foreground">
            No approved documents or posted payments.
          </p>
        )}
      </div>
      <FormCard title="Outstanding aging by due date">
        <p className="mb-4 text-sm text-muted-foreground">
          Current includes undated and future-due documents. Buckets show days
          past due.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Party / currency",
                  "Side",
                  "Current",
                  "0–30",
                  "31–60",
                  "61–90",
                  "90+",
                ].map((h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.flatMap((b) =>
                [
                  { label: "Payable", values: b.payableAging },
                  { label: "Receivable", values: b.receivableAging },
                ].map((a) => (
                  <tr
                    key={`${b.party.id}:${b.currency}:${a.label}`}
                    className="border-t"
                  >
                    <td className="p-2">
                      {b.party.displayName} · {b.currency}
                    </td>
                    <td className="p-2">{a.label}</td>
                    {Object.entries(a.values).map(([bucket, value]) => (
                      <td key={bucket} className="p-2">
                        {money(value)}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </FormCard>
    </div>
  );
}
