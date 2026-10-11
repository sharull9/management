import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { requireOrgContext, requireProjectContext } from "@/core/context";
import { financeData } from "../../server/queries";
import { AllocationForm } from "../components/allocation-form";
import { PaymentVoidDialog } from "../components/payment-void-dialog";
import { date, formData, linkClass, money } from "../util";

export async function PaymentDetail({ org, id }: { org: string; id: string }) {
  const ctx = await requireOrgContext(org);
  const salesOnly =
    !ctx.isAdmin &&
    !ctx.permissions.has("payment.view") &&
    ctx.permissions.has("sales.view");
  const d = await financeData(org, salesOnly ? "sales.view" : "payment.view"),
    row = d.payments.find((p) => p.id === id);
  if (!row || (salesOnly && row.direction !== "INCOMING")) notFound();
  const permissionCtx = row.projectId
    ? await requireProjectContext(org, row.projectId)
    : d.ctx;
  const canRecord =
    permissionCtx.isAdmin || permissionCtx.permissions.has("payment.record");
  const posted = row.status === "POSTED" && canRecord;
  const documents =
    row.direction === "OUTGOING"
      ? formData(d).bills
      : d.invoices
          .filter((i) => i.payableTotal.gt(i.receivedTotal))
          .map((i) => ({
            id: i.id,
            code: i.code,
            partyId: i.partyId,
            projectId: i.projectId,
            currency: i.currency,
            outstanding: money(i.payableTotal.sub(i.receivedTotal)),
          }));
  return (
    <>
      <Button asChild variant="link" size="sm" className="w-fit px-0">
        <Link href={`/${org}/finance/payments`}>All payments</Link>
      </Button>
      <PageHeading
        eyebrow={row.code}
        title={`${row.currency} ${money(row.amount)}`}
        description={`${row.party.displayName} · ${row.direction}`}
        actions={
          <>
            <StatusBadge status={row.status} />
            <Button asChild variant="outline">
              <Link
                href={`/${org}/finance/balances/${row.partyId}?currency=${row.currency}`}
              >
                Party statement
              </Link>
            </Button>
            {posted && row.unallocatedAmount.gt(0) && (
              <SideSheet
                title="Allocate advance"
                description={`${money(row.unallocatedAmount)} available`}
                trigger="Allocate"
                triggerVariant="outline"
                width="xl"
              >
                <AllocationForm
                  key={`${row.id}:${row.updatedAt.toISOString()}`}
                  org={org}
                  paymentId={id}
                  direction={row.direction}
                  partyId={row.partyId}
                  projectId={row.projectId}
                  currency={row.currency}
                  documents={documents.filter(
                    (r) =>
                      r.partyId === row.partyId &&
                      r.currency === row.currency &&
                      (!row.projectId || r.projectId === row.projectId),
                  )}
                />
              </SideSheet>
            )}
            {posted && <PaymentVoidDialog org={org} id={id} code={row.code} />}
          </>
        }
      />
      <section className="space-y-3">
        <SectionHeader title="Overview" />
        <DetailList
          className="max-w-2xl"
          items={[
            { label: "Date", value: date(row.date) },
            { label: "Mode", value: row.mode },
            { label: "Reference", value: row.reference },
            {
              label: "Project",
              value:
                d.projects.find((p) => p.id === row.projectId)?.name ??
                "Organization",
            },
            { label: "Allocated", value: money(row.allocatedAmount) },
            {
              label:
                row.status === "VOID"
                  ? "Reversed amount"
                  : "Unallocated advance",
              value: money(row.unallocatedAmount),
            },
            {
              label: "Payment request",
              value: row.paymentRequestId ? (
                <Link
                  className={linkClass}
                  href={`/${org}/finance/payment-requests/${row.paymentRequestId}`}
                >
                  View request
                </Link>
              ) : null,
            },
            { label: "Notes", value: row.notes?.trim() || null },
          ]}
        />
      </section>
      <UrlTabs
        tabs={[
          {
            value: "allocations",
            label:
              row.status === "VOID" ? "Reversed allocations" : "Allocations",
            count: row.allocations.length,
            content: (
              <>
                <SectionHeader
                  title={
                    row.status === "VOID"
                      ? "Reversed allocations"
                      : "Allocations"
                  }
                />
                {row.allocations.length ? (
                  <ItemGroup>
                    {row.allocations.map((a) => (
                      <Item key={a.id} variant="outline">
                        <ItemContent>
                          <Link
                            className={linkClass}
                            href={`/${org}/${a.vendorBillId ? `procurement/bills/${a.vendorBillId}` : `sales/invoices/${a.salesInvoiceId}`}`}
                          >
                            {a.vendorBill?.code ?? a.salesInvoice?.code}
                          </Link>{" "}
                          · {money(a.amount)} · {date(a.allocatedAt)}
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                ) : (
                  <EmptyState title="No allocations yet." />
                )}
              </>
            ),
          },
        ]}
      />
    </>
  );
}
