import { Plus } from "lucide-react";
import Link from "next/link";
import { toOptions } from "@/components/shared/form/enum-options";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
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
    <>
      <PageHeading
        title="Vendor bills"
        description="Vendor invoices, approvals and outstanding balances."
        actions={
          d.writable && (
            <Button asChild>
              <Link href={`/${org}/procurement/bills/new`}>
                <Plus data-icon="inline-start" />
                New vendor bill
              </Link>
            </Button>
          )
        }
      />
      <BillsTable
        org={org}
        toolbar={
          <BillFilters
            org={org}
            projects={toOptions(d.projects)}
            vendors={d.vendors.map((v) => ({
              value: v.id,
              label: v.displayName,
            }))}
          />
        }
        rows={d.rows.map((r) => ({
          id: r.id,
          org,
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
    </>
  );
}
