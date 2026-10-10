import Link from "next/link";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Decimal } from "@/core/decimal";

import { isInvoiceOverdue } from "../../server/calculations";
import { salesData } from "../../server/queries";

export async function InvoiceList({
  org,
  filters,
}: {
  org: string;
  filters: Record<string, string | undefined>;
}) {
  const d = await salesData(org, filters.projectId);
  const rows = d.invoices.filter(
    (r) =>
      (!filters.customerId || r.partyId === filters.customerId) &&
      (!filters.status || r.status === filters.status) &&
      (filters.overdue !== "1" ||
        isInvoiceOverdue(
          {
            status: r.status,
            dueDate: r.dueDate,
            payableTotal: r.payableTotal.toString(),
            receivedTotal: r.receivedTotal.toString(),
          },
          new Date(),
        )),
  );
  const billing = rows.filter((r) =>
    ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(r.status),
  );
  const currencies = [...new Set(billing.map((r) => r.currency))];
  return (
    <>
      <PageHeading
        title="Sales invoices"
        description="Track customer billing, approvals and balances."
      />
      <Link
        className="underline"
        href={`/${org}/sales/invoices/new${filters.projectId ? `?projectId=${filters.projectId}` : ""}`}
      >
        New invoice
      </Link>
      <FormCard title="Filters">
        <form className="flex flex-wrap gap-4">
          <label>
            Customer
            <select
              name="customerId"
              defaultValue={filters.customerId ?? ""}
              className="block rounded border p-2"
            >
              <option value="">All customers</option>
              {d.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Project
            <select
              name="projectId"
              defaultValue={filters.projectId ?? ""}
              className="block rounded border p-2"
            >
              <option value="">All projects</option>
              {d.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="block rounded border p-2"
            >
              <option value="">All statuses</option>
              {[
                "DRAFT",
                "PENDING_APPROVAL",
                "APPROVED",
                "PARTIALLY_PAID",
                "PAID",
                "CANCELLED",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="overdue"
              value="1"
              defaultChecked={filters.overdue === "1"}
            />
            Overdue
          </label>
          <button type="submit" className="rounded border px-4">
            Apply
          </button>
        </form>
      </FormCard>
      {filters.projectId && (
        <FormCard title="Project billing">
          <p className="text-sm">
            Approved invoices in the current filters, grouped by currency.
          </p>
          {currencies.map((currency) => {
            const invoices = billing.filter((r) => r.currency === currency);
            const payable = invoices.reduce(
              (a, r) => a.add(r.payableTotal),
              new Decimal(0),
            );
            const received = invoices.reduce(
              (a, r) => a.add(r.receivedTotal),
              new Decimal(0),
            );
            return (
              <p key={currency}>
                {currency}: billed {payable.toFixed(2)} · received{" "}
                {received.toFixed(2)} · balance{" "}
                {payable.sub(received).toFixed(2)}
              </p>
            );
          })}
        </FormCard>
      )}
      <FormCard title="Invoices">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Code",
                  "Customer",
                  "Project",
                  "Date",
                  "Due",
                  "Grand total",
                  "Received",
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
              {rows.map((r) => (
                <tr className="border-t" key={r.id}>
                  <td className="p-2">
                    <Link
                      className="underline"
                      href={`/${org}/sales/invoices/${r.id}`}
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="p-2">{r.party.displayName}</td>
                  <td className="p-2">{r.project?.name ?? "—"}</td>
                  <td className="p-2">{r.date.toISOString().slice(0, 10)}</td>
                  <td className="p-2">
                    {r.dueDate?.toISOString().slice(0, 10) ?? "—"}
                  </td>
                  <td className="p-2">
                    {r.currency} {r.grandTotal.toFixed(2)}
                  </td>
                  <td className="p-2">{r.receivedTotal.toFixed(2)}</td>
                  <td className="p-2">
                    {r.payableTotal.sub(r.receivedTotal).toFixed(2)}
                  </td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p>No invoices match these filters.</p>}
      </FormCard>
    </>
  );
}
