import Link from "next/link";
import { SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { billList, billStatuses } from "../../server/queries";

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
export async function BillsList({
  org,
  filters,
}: {
  org: string;
  filters: {
    projectId?: string;
    partyId?: string;
    status?: string;
    overdue?: string;
  };
}) {
  const d = await billList(org, filters);
  return (
    <div className="space-y-6">
      <PageHeading
        title="Vendor bills"
        description="Vendor invoices, approvals and outstanding balances."
      />
      {d.writable && (
        <Link
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          href={`/${org}/procurement/bills/new`}
        >
          Create bill
        </Link>
      )}
      <FormCard title="Filters">
        <form className="grid gap-4 md:grid-cols-5">
          <SelectField
            label="Project"
            name="projectId"
            defaultValue={filters.projectId ?? ""}
          >
            <option value="">All projects</option>
            {d.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Vendor"
            name="partyId"
            defaultValue={filters.partyId ?? ""}
          >
            <option value="">All vendors</option>
            {d.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">All statuses</option>
            {billStatuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Due"
            name="overdue"
            defaultValue={filters.overdue ?? ""}
          >
            <option value="">All bills</option>
            <option value="1">Overdue with balance</option>
          </SelectField>
          <button
            className="self-end rounded-md border px-4 py-2 text-sm"
            type="submit"
          >
            Apply filters
          </button>
        </form>
      </FormCard>
      <FormCard title="Bills">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Code",
                  "Vendor invoice",
                  "Vendor",
                  "Project",
                  "Date",
                  "Due",
                  "Grand total",
                  "Paid",
                  "Balance",
                  "Status",
                ].map((h) => (
                  <th className="p-2" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr className="border-t" key={r.id}>
                  <td className="p-2">
                    <Link
                      className="underline"
                      href={`/${org}/procurement/bills/${r.id}`}
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="p-2">{r.vendorInvoiceNo}</td>
                  <td className="p-2">{r.party.displayName}</td>
                  <td className="p-2">{r.project.name}</td>
                  <td className="p-2">{day(r.date)}</td>
                  <td className="p-2">{day(r.dueDate)}</td>
                  <td className="p-2">
                    {r.grandTotal.toFixed(2)} {r.currency}
                  </td>
                  <td className="p-2">{r.paidTotal.toFixed(2)}</td>
                  <td className="p-2">
                    {r.payableTotal.sub(r.paidTotal).toFixed(2)}
                  </td>
                  <td className="p-2">
                    <Badge variant="secondary">
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.rows.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            No bills match these filters.
          </p>
        )}
      </FormCard>
    </div>
  );
}
