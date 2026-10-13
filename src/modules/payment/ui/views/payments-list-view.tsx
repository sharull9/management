import { Plus, Scale } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { financeData } from "../../server/queries";
import { FinanceFilters } from "../components/finance-filters";
import { PaymentTable } from "../components/payment-table";
import { money } from "../util";

export async function PaymentsList({
  org,
  projectId,
}: {
  org: string;
  projectId?: string;
}) {
  const d = await financeData(org, "payment.view", projectId);
  const payments = d.payments.filter(
    (p) =>
      d.canViewOrg ||
      (p.projectId !== null && (!projectId || p.projectId === projectId)),
  );
  const canCreate =
    d.ctx.isAdmin ||
    d.ctx.permissions.has("payment.record") ||
    !!(await db.project.findFirst({
      where: moduleProjectWhere(d.ctx, "payment.record"),
    }));
  return (
    <div className="space-y-6">
      <PageHeading
        title="Payments"
        description="Track settlements and unallocated advances."
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
                <Link href={`/${org}/finance/payments/new`}>
                  <Plus data-icon="inline-start" />
                  New payment
                </Link>
              </Button>
            )}
          </>
        }
      />
      <PaymentTable
        org={org}
        toolbar={
          <FinanceFilters
            org={org}
            permission="payment.view"
            projects={d.projects.map((p) => ({ id: p.id, name: p.name }))}
          />
        }
        data={payments.map((p) => ({
          id: p.id,
          code: p.code,
          party: p.party.displayName,
          direction: p.direction,
          project:
            d.projects.find((r) => r.id === p.projectId)?.name ??
            "Organization",
          date: p.date.toISOString(),
          mode: p.mode,
          currency: p.currency,
          amount: money(p.amount),
          baseAmount: money(p.baseAmount),
          allocated: money(p.allocatedAmount),
          unallocated: money(p.unallocatedAmount),
          status: p.status,
        }))}
      />
    </div>
  );
}
