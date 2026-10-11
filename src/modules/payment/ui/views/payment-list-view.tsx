import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { financeData } from "../../server/queries";
import { ProjectFilter } from "../components/project-filter";
import { date, linkClass, money } from "../util";
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
      />
      <div className="flex flex-wrap gap-4">
        {canCreate && (
          <Link
            className={linkClass}
            href={`/${org}/finance/${requests ? "payment-requests" : "payments"}/new`}
          >
            New {requests ? "payment request" : "payment"}
          </Link>
        )}
        <Link className={linkClass} href={`/${org}/finance/balances`}>
          Party balances
        </Link>
      </div>
      <ProjectFilter projects={d.projects} projectId={projectId} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Document",
                "Date",
                "Party",
                "Project",
                "Status",
                "Amount",
                "Allocation",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests
              ? d.requests.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <Link
                        className={linkClass}
                        href={`/${org}/finance/payment-requests/${r.id}`}
                      >
                        {r.code}
                      </Link>
                    </td>
                    <td className="p-3">{date(r.date)}</td>
                    <td className="p-3">{r.party.displayName}</td>
                    <td className="p-3">
                      {d.projects.find((p) => p.id === r.projectId)?.name ??
                        "Organization"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{r.status}</Badge>
                    </td>
                    <td className="p-3">
                      {r.currency} {money(r.amount)}
                    </td>
                    <td className="p-3">{r.purpose}</td>
                  </tr>
                ))
              : payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <Link
                        className={linkClass}
                        href={`/${org}/finance/payments/${p.id}`}
                      >
                        {p.code}
                      </Link>
                    </td>
                    <td className="p-3">{date(p.date)}</td>
                    <td className="p-3">
                      {p.party.displayName}
                      <p className="text-xs text-muted-foreground">
                        {p.direction}
                      </p>
                    </td>
                    <td className="p-3">
                      {d.projects.find((r) => r.id === p.projectId)?.name ??
                        "Organization"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{p.status}</Badge>
                    </td>
                    <td className="p-3">
                      {p.currency} {money(p.amount)}
                    </td>
                    <td className="p-3">
                      {p.status === "VOID"
                        ? "Reversed"
                        : p.unallocatedAmount.isZero()
                          ? "Fully allocated"
                          : p.allocatedAmount.isZero()
                            ? "Advance"
                            : "Partially allocated"}
                      {p.status === "POSTED" && (
                        <p className="text-xs text-muted-foreground">
                          {money(p.unallocatedAmount)} unallocated
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!(requests ? d.requests : payments).length && (
          <p className="p-6 text-sm text-muted-foreground">No records yet.</p>
        )}
      </div>
    </div>
  );
}
