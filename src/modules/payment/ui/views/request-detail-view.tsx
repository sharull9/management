import { ArrowLeft, Banknote, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { formatMoney } from "@/core/format";
import { financeData } from "../../server/queries";
import { RequestSubmitButton } from "../components/request-submit-button";
import { date, linkClass, money } from "../util";

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
  const draft = row.status === "DRAFT" && canEdit;
  const project =
    d.projects.find((p) => p.id === row.projectId)?.name ?? "Organization";
  const amount = formatMoney(money(row.amount), row.currency);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          href={`/${org}/finance/payment-requests`}
        >
          <ArrowLeft className="size-4" />
          All payment requests
        </Link>
        <PageHeading
          eyebrow="Payment request"
          title={row.code}
          description={`${row.party.displayName} · ${project} · ${amount}`}
          actions={
            <>
              <StatusBadge status={row.status} />
              {draft && (
                <Button asChild variant="outline">
                  <Link href={`/${org}/finance/payment-requests/${id}/edit`}>
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Link>
                </Button>
              )}
              {draft && (
                <RequestSubmitButton org={org} id={id} code={row.code} />
              )}
              {row.status === "APPROVED" && canPay && (
                <Button asChild>
                  <Link href={`/${org}/finance/payments/new?requestId=${id}`}>
                    <Banknote data-icon="inline-start" />
                    Record payment
                  </Link>
                </Button>
              )}
            </>
          }
        />
      </div>
      <section className="space-y-3">
        <SectionHeader title="Overview" />
        <DetailList
          className="max-w-2xl"
          items={[
            { label: "Party", value: row.party.displayName },
            { label: "Project", value: project },
            { label: "Requested", value: date(row.date) },
            { label: "Purpose", value: row.purpose.replaceAll("_", " ") },
            { label: "Mode", value: row.mode },
            { label: "Amount", value: amount },
            {
              label: "Reason",
              value: row.reason ? (
                <span className="whitespace-pre-wrap">{row.reason}</span>
              ) : null,
            },
          ]}
        />
      </section>
      <UrlTabs
        tabs={[
          {
            value: "documents",
            label: "Linked bills",
            count: row.bills.length,
            content: row.bills.length ? (
              <ItemGroup>
                {row.bills.map((b) => (
                  <Item key={b.id} variant="outline">
                    <ItemContent>
                      <span>
                        <Link
                          className={linkClass}
                          href={`/${org}/procurement/bills/${b.billId}`}
                        >
                          {d.bills.find((r) => r.id === b.billId)?.code ??
                            b.billId}
                        </Link>{" "}
                        · {money(b.amount)}
                      </span>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <EmptyState title="No linked bills." />
            ),
          },
          {
            value: "payments",
            label: "Payments",
            count: row.payments.length,
            content: row.payments.length ? (
              <ItemGroup>
                {row.payments.map((p) => (
                  <Item key={p.id} variant="outline">
                    <ItemContent>
                      <span>
                        <Link
                          className={linkClass}
                          href={`/${org}/finance/payments/${p.id}`}
                        >
                          {p.code}
                        </Link>{" "}
                        · {money(p.amount)}
                      </span>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <EmptyState title="No posted payments." />
            ),
          },
          {
            value: "approvals",
            label: "Approvals",
            count: approvals.length,
            content: approvals.length ? (
              <ApprovalTimeline
                org={org}
                approvals={approvals}
                variant="payment"
              />
            ) : (
              <EmptyState title="Not submitted for approval." />
            ),
          },
        ]}
      />
    </div>
  );
}
