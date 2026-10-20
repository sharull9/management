import { Plus, Scale } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { db } from "@/core/db";
import type { ListParams } from "@/core/pagination";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { paymentListData } from "../../server/list-queries";
import { FinanceFilters } from "../components/finance-filters";
import { FinanceTable } from "../components/finance-tables";
import { money } from "../util";
export async function FinanceList({
  org,
  kind,
  projectId,
  params,
}: {
  org: string;
  kind: "payments" | "payment-requests" | "receipts";
  projectId?: string;
  params?: ListParams;
}) {
  const d = await paymentListData(
    org,
    params,
    kind === "receipts" ? "sales.view" : "payment.view",
    projectId,
    kind === "receipts",
  );
  const requests = kind === "payment-requests";
  const payments = d.rows;
  const canCreate =
    d.ctx.isAdmin ||
    d.ctx.permissions.has(
      requests ? "payment.request.create" : "payment.record",
    ) ||
    !!(await db.project.findFirst({
      where: moduleProjectWhere(
        d.ctx,
        requests ? "payment.request.create" : "payment.record",
      ),
    }));
  return (
    <div className="space-y-6">
      <PageHeading
        title={
          requests
            ? "Payment requests"
            : kind === "receipts"
              ? "Receipts"
              : "Payments"
        }
        description="Track approved requests, settlements and unallocated advances."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${org}/finance/balances`}>
                <Scale data-icon="inline-start" />
                Party balances
              </Link>
            </Button>
            {canCreate && (
              <Button asChild>
                <Link
                  href={`/${org}/finance/${requests ? "payment-requests" : "payments"}/new`}
                >
                  <Plus data-icon="inline-start" />
                  New {requests ? "payment request" : "payment"}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <FinanceTable
        org={org}
        toolbar={
          <FinanceFilters
            org={org}
            permission={kind === "receipts" ? "sales.view" : "payment.view"}
            projects={d.projects.map((p) => ({ id: p.id, name: p.name }))}
            dateRange
            fields={[
              {
                name: "status",
                label: "Status",
                multiple: true,
                options: [
                  { value: "POSTED", label: "Posted" },
                  { value: "VOID", label: "Void" },
                ],
              },
            ]}
          />
        }
        requests={requests}
        data={payments.map((p) => ({
          id: p.id,
          code: p.code,
          date: p.date.toISOString(),
          party: p.party.displayName,
          project: p.projectLabel,
          status: p.status,
          currency: p.currency,
          amount: money(p.amount),
          baseAmount: money(p.baseAmount),
          direction: p.direction,
          allocation:
            p.status === "VOID"
              ? "Reversed"
              : `${p.unallocatedAmount.isZero() ? "Fully allocated" : p.allocatedAmount.isZero() ? "Advance" : "Partially allocated"} | ${money(p.unallocatedAmount)} unallocated`,
        }))}
        serverPage={d.page}
      />
    </div>
  );
}
