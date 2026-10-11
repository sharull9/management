import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { requireOrgContext, requireProjectContext } from "@/core/context";
import { financeData } from "../../server/queries";
import { AllocationForm } from "../components/allocation-form";
import { VoidPaymentForm } from "../components/payment-actions-form";

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
    <div className="space-y-6">
      <PageHeading
        title={row.code}
        description={`${row.party.displayName} · ${row.direction} · ${row.status} · ${row.currency} ${money(row.amount)}`}
      />
      <FormCard title="Payment">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>Date: {date(row.date)}</div>
          <div>Mode: {row.mode}</div>
          <div>Reference: {row.reference ?? "None"}</div>
          <div>
            Project:{" "}
            {d.projects.find((p) => p.id === row.projectId)?.name ??
              "Organization"}
          </div>
          <div>Allocated: {money(row.allocatedAmount)}</div>
          <div>
            {row.status === "VOID" ? "Reversed amount" : "Unallocated advance"}:{" "}
            {money(row.unallocatedAmount)}
          </div>
        </dl>
        {row.paymentRequestId && (
          <Link
            className={linkClass}
            href={`/${org}/finance/payment-requests/${row.paymentRequestId}`}
          >
            Payment request
          </Link>
        )}
        <p className="mt-4 whitespace-pre-wrap text-sm">{row.notes}</p>
      </FormCard>
      <FormCard
        title={row.status === "VOID" ? "Reversed allocations" : "Allocations"}
      >
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
        {!row.allocations.length && <EmptyState title="No allocations yet." />}
      </FormCard>
      {row.status === "POSTED" && canRecord && (
        <>
          {row.unallocatedAmount.gt(0) && (
            <FormCard
              title={`Allocate advance · ${money(row.unallocatedAmount)} available`}
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
            </FormCard>
          )}
          <FormCard title="Void payment">
            <VoidPaymentForm org={org} id={id} />
          </FormCard>
        </>
      )}
      <Link
        className={linkClass}
        href={`/${org}/finance/balances/${row.partyId}?currency=${row.currency}`}
      >
        Party statement
      </Link>
    </div>
  );
}
