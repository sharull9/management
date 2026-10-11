import { Plus, Scale } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { financeData } from "../../server/queries";
import { FinanceFilters } from "../components/finance-filters";
import { FinanceTable } from "../components/finance-tables";
import { money } from "../util";
export async function FinanceList({
  org,
  kind,
  projectId,
}: {
  org: string;
  kind: "payments" | "payment-requests" | "receipts";
  projectId?: string;
}) {
  const d = await financeData(
    org,
    kind === "receipts" ? "sales.view" : "payment.view",
    projectId,
  );
  const requests = kind === "payment-requests";
  const payments = d.payments.filter(
    (p) =>
      (kind !== "receipts" || p.direction === "INCOMING") &&
      (d.canViewOrg ||
        (p.projectId !== null && (!projectId || p.projectId === projectId))),
  );
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
          />
        }
        requests={requests}
        data={
          requests
            ? d.requests.map((r) => ({
                id: r.id,
                code: r.code,
                date: r.date.toISOString(),
                party: r.party.displayName,
                project:
                  d.projects.find((p) => p.id === r.projectId)?.name ??
                  "Organization",
                status: r.status,
                currency: r.currency,
                amount: money(r.amount),
                allocation: r.purpose,
                direction: "",
              }))
            : payments.map((p) => ({
                id: p.id,
                code: p.code,
                date: p.date.toISOString(),
                party: p.party.displayName,
                project:
                  d.projects.find((r) => r.id === p.projectId)?.name ??
                  "Organization",
                status: p.status,
                currency: p.currency,
                amount: money(p.amount),
                direction: p.direction,
                allocation:
                  p.status === "VOID"
                    ? "Reversed"
                    : `${p.unallocatedAmount.isZero() ? "Fully allocated" : p.allocatedAmount.isZero() ? "Advance" : "Partially allocated"} | ${money(p.unallocatedAmount)} unallocated`,
              }))
        }
      />
    </div>
  );
}
