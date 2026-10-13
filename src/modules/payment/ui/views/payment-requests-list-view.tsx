import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { financeData } from "../../server/queries";
import { FinanceFilters } from "../components/finance-filters";
import { RequestTable } from "../components/request-table";
import { money } from "../util";

export async function FinanceList({
  org,
  projectId,
}: {
  org: string;
  kind?: string;
  projectId?: string;
}) {
  const d = await financeData(org, "payment.view", projectId);
  const canCreate =
    d.ctx.isAdmin ||
    d.ctx.permissions.has("payment.request.create") ||
    !!(await db.project.findFirst({
      where: moduleProjectWhere(d.ctx, "payment.request.create"),
    }));
  return (
    <div className="space-y-6">
      <PageHeading
        title="Payment requests"
        description="Request payments to vendors, track approval and settlement."
        actions={
          canCreate && (
            <Button asChild>
              <Link href={`/${org}/finance/payment-requests/new`}>
                <Plus data-icon="inline-start" />
                New payment request
              </Link>
            </Button>
          )
        }
      />
      <RequestTable
        org={org}
        toolbar={
          <FinanceFilters
            org={org}
            permission="payment.view"
            projects={d.projects.map((p) => ({ id: p.id, name: p.name }))}
          />
        }
        data={d.requests.map((r) => ({
          id: r.id,
          code: r.code,
          date: r.date.toISOString(),
          party: r.party.displayName,
          project:
            d.projects.find((p) => p.id === r.projectId)?.name ??
            "Organization",
          documents: r.bills
            .map((b) => d.bills.find((x) => x.id === b.billId)?.code ?? "")
            .filter(Boolean)
            .join(", "),
          status: r.status,
          currency: r.currency,
          amount: money(r.amount),
          baseAmount: money(r.baseAmount),
        }))}
      />
    </div>
  );
}
