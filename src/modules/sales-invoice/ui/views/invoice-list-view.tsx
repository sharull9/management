import { Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { parseMultiParam } from "@/components/shared/filter-bar/multi-param";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { StatTiles } from "@/components/shared/stat-tiles";
import { Button } from "@/components/ui/button";
import { Decimal } from "@/core/decimal";
import { formatMoney } from "@/core/format";
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
  const customerIds = parseMultiParam(filters.customerId);
  const statuses = parseMultiParam(filters.status);
  const d = await salesData(org, filters.projectId, "sales.view", {
    customerIds,
  });
  const rows = d.invoices.filter(
    (r) =>
      (!customerIds.length || customerIds.includes(r.partyId)) &&
      (!statuses.length || statuses.includes(r.status)) &&
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
        actions={
          <Button asChild>
            <Link
              href={`/${org}/sales/invoices/new${filters.projectId ? `?projectId=${filters.projectId}` : ""}`}
            >
              <Plus data-icon="inline-start" />
              New invoice
            </Link>
          </Button>
        }
      />
      {filters.projectId &&
        (currencies.length ? (
          currencies.map((currency) => {
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
              <StatTiles
                key={currency}
                stats={[
                  {
                    label: "Billed",
                    value: formatMoney(payable, currency),
                    detail: "Approved invoices in these filters",
                  },
                  {
                    label: "Received",
                    value: formatMoney(received, currency),
                  },
                  {
                    label: "Balance",
                    value: formatMoney(payable.sub(received), currency),
                  },
                ]}
              />
            );
          })
        ) : (
          <EmptyState title="No approved invoices in these filters." />
        ))}
      <FormCard title="Invoices">
        <InvoicesTable
          org={org}
          toolbar={
            <InvoiceFilters
              org={org}
              customers={d.customers.map((row) => ({
                value: row.id,
                label: row.displayName,
              }))}
              projects={d.projects
                .filter((row) => row.id === filters.projectId)
                .map((row) => ({ value: row.id, label: row.name }))}
            />
          }
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
