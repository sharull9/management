import Link from "next/link";
import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { billFilterInput } from "../../schema";
import { billList } from "../../server/queries";
import { BillFilters } from "../components/bill-filters";
import { BillsTable } from "../components/bills-table";

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
        <BillFilters
          org={org}
          projects={toOptions(d.projects)}
          vendors={d.vendors.map((v) => ({
            value: v.id,
            label: v.displayName,
          }))}
          initial={{
            projectId: filters.projectId || null,
            partyId: filters.partyId || null,
            status:
              billFilterInput.shape.status.safeParse(filters.status || null)
                .data ?? null,
            overdue: filters.overdue === "1" ? "1" : null,
          }}
        />
      </FormCard>
      <FormCard title="Bills">
        <BillsTable
          org={org}
          rows={d.rows.map((r) => ({
            id: r.id,
            code: r.code,
            vendorInvoiceNo: r.vendorInvoiceNo,
            vendor: r.party.displayName,
            project: r.project.name,
            date: day(r.date),
            dueDate: day(r.dueDate),
            currency: r.currency,
            grandTotal: r.grandTotal.toFixed(2),
            paidTotal: r.paidTotal.toFixed(2),
            balance: r.payableTotal.sub(r.paidTotal).toFixed(2),
            status: r.status,
          }))}
        />
      </FormCard>
    </div>
  );
}
