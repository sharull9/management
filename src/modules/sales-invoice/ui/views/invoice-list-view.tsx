import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Decimal } from "@/core/decimal";
import { isInvoiceOverdue } from "../../server/calculations";
import { salesData } from "../../server/queries";
import { InvoiceFilters } from "../components/invoice-filters";
import { InvoicesTable } from "../components/invoices-table";

export async function InvoiceList({
  org,
  filters,
}: {
  org: string;
  filters: Record<string, string | undefined>;
}) {
  const d = await salesData(org, filters.projectId, "sales.view", {
    customerIds: filters.customerId ? [filters.customerId] : [],
  });
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
        <InvoiceFilters
          org={org}
          filters={filters}
          customers={d.customers.map((row) => ({
            value: row.id,
            label: row.displayName,
          }))}
          projects={d.projects
            .filter((row) => row.id === filters.projectId)
            .map((row) => ({ value: row.id, label: row.name }))}
        />
      </FormCard>
      {filters.projectId && (
        <FormCard title="Project billing">
          <p className="text-sm">
            Approved invoices in the current filters, grouped by currency.
          </p>
          <ItemGroup>
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
                <Item key={currency} variant="outline">
                  <ItemContent>
                    <ItemTitle>
                      {currency}: billed {payable.toFixed(2)} · received{" "}
                      {received.toFixed(2)} · balance{" "}
                      {payable.sub(received).toFixed(2)}
                    </ItemTitle>
                  </ItemContent>
                </Item>
              );
            })}
          </ItemGroup>
          {!currencies.length && (
            <EmptyState title="No approved invoices in these filters." />
          )}
        </FormCard>
      )}
      <FormCard title="Invoices">
        <InvoicesTable
          org={org}
          rows={rows.map((row) => ({
            id: row.id,
            code: row.code,
            customer: row.party.displayName,
            project: row.project?.name ?? "Unspecified",
            date: row.date.toISOString().slice(0, 10),
            dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
            currency: row.currency,
            grandTotal: row.grandTotal.toString(),
            receivedTotal: row.receivedTotal.toString(),
            balance: row.payableTotal.sub(row.receivedTotal).toString(),
            status: row.status,
          }))}
        />
      </FormCard>
    </>
  );
}
