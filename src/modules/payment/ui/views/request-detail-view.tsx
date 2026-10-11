import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { financeData } from "../../server/queries";
import { SubmitRequestForm } from "../components/payment-actions-form";
import { RequestForm } from "../components/request-form";

import { date, formData, linkClass, money } from "../util";
export async function RequestDetail({ org, id }: { org: string; id: string }) {
  const d = await financeData(org),
    row = d.requests.find((r) => r.id === id);
  if (!row) notFound();
  const approvals = await db.approvalRequest.findMany({
    where: {
      organizationId: d.ctx.org.id,
      documentType: "PAYMENT_REQUEST",
      documentId: id,
    },
    include: {
      steps: { include: { actedBy: true }, orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const permissionCtx = row.projectId
    ? await requireProjectContext(org, row.projectId)
    : d.ctx;
  const canEdit =
      permissionCtx.isAdmin ||
      permissionCtx.permissions.has("payment.request.create"),
    canPay =
      permissionCtx.isAdmin || permissionCtx.permissions.has("payment.record");
  return (
    <div className="space-y-6">
      <PageHeading
        title={row.code}
        description={`${row.party.displayName} · ${row.status} · ${row.currency} ${money(row.amount)}`}
      />
      <FormCard title="Request">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>Date: {date(row.date)}</div>
          <div>Purpose: {row.purpose}</div>
          <div>Mode: {row.mode}</div>
          <div>
            Project:{" "}
            {d.projects.find((p) => p.id === row.projectId)?.name ??
              "Organization"}
          </div>
        </dl>
        <p className="mt-4 whitespace-pre-wrap text-sm">{row.reason}</p>
        <ItemGroup className="mt-4">
          {row.bills.map((b) => (
            <Item key={b.id} variant="outline">
              <ItemContent>
                <Link href={`/${org}/procurement/bills/${b.billId}`}>
                  {d.bills.find((r) => r.id === b.billId)?.code ?? b.billId}
                </Link>{" "}
                · {money(b.amount)}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </FormCard>
      {row.status === "DRAFT" && canEdit && (
        <>
          <FormCard title="Edit draft">
            <RequestForm
              org={org}
              data={formData(d)}
              draft={{
                id: row.id,
                partyId: row.partyId,
                projectId: row.projectId,
                date: date(row.date),
                amount: money(row.amount),
                mode: row.mode,
                purpose: row.purpose,
                reason: row.reason,
                allocations: row.bills.map((b) => ({
                  documentId: b.billId,
                  amount: money(b.amount),
                  code:
                    d.bills.find((bill) => bill.id === b.billId)?.code ??
                    b.billId,
                })),
              }}
            />
          </FormCard>
          <SubmitRequestForm org={org} id={id} />
        </>
      )}
      {row.status === "APPROVED" && canPay && (
        <Link
          className={linkClass}
          href={`/${org}/finance/payments/new?requestId=${id}`}
        >
          Record payment against request
        </Link>
      )}
      <FormCard title="Payments">
        <ItemGroup>
          {row.payments.map((p) => (
            <Item key={p.id} variant="outline">
              <ItemContent>
                <Link
                  className={linkClass}
                  href={`/${org}/finance/payments/${p.id}`}
                >
                  {p.code}
                </Link>{" "}
                · {money(p.amount)}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
        {!row.payments.length && <EmptyState title="No posted payments." />}
      </FormCard>
      <ApprovalTimeline org={org} approvals={approvals} variant="payment" />
    </div>
  );
}
