import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { requireOrgContext, requireProjectContext } from "@/server/context";
import { db } from "@/server/db";
import {
  submitRequestAction,
  voidPaymentAction,
} from "@/server/payments/actions";
import { Decimal } from "@/server/payments/allocation";
import {
  type FinanceData,
  financeData,
  partyBalances,
  partyStatement,
} from "@/server/payments/queries";
import { moduleProjectWhere } from "@/server/procurement/queries";
import {
  AllocationForm,
  type FormData,
  PaymentForm,
  RequestForm,
} from "./forms";

const money = (v: { toFixed: (places: number) => string }) => v.toFixed(2);
const date = (d: Date) => d.toISOString().slice(0, 10);
const linkClass = "text-sm font-medium underline underline-offset-4";
function formData(d: FinanceData): FormData {
  return {
    baseCurrency: d.ctx.org.baseCurrency,
    allowOrganization: d.allowOrganization,
    projects: d.projects.map((p) => ({
      id: p.id,
      name: `${p.code} · ${p.name}`,
      currency: p.currency,
    })),
    parties: d.parties.map((p) => ({
      id: p.id,
      name: p.displayName,
      isVendor: p.isVendor,
      isCustomer: p.isCustomer,
    })),
    bills: d.bills
      .filter((b) => b.payableTotal.gt(b.paidTotal))
      .map((b) => ({
        id: b.id,
        code: b.code,
        partyId: b.partyId,
        projectId: b.projectId,
        currency: b.currency,
        outstanding: money(b.payableTotal.sub(b.paidTotal)),
      })),
    requests: d.requests
      .filter((r) => r.status === "APPROVED")
      .map((r) => ({
        id: r.id,
        code: r.code,
        partyId: r.partyId,
        projectId: r.projectId,
        currency: r.currency,
        mode: r.mode,
        remaining: money(
          r.amount.sub(
            r.payments.reduce((v, p) => v.add(p.amount), new Decimal(0)),
          ),
        ),
      })),
  };
}
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
function ProjectFilter({
  projects,
  projectId,
}: {
  projects: FinanceData["projects"];
  projectId?: string;
}) {
  return (
    <form className="flex max-w-md items-end gap-3">
      <SelectField
        label="Project"
        name="projectId"
        defaultValue={projectId ?? ""}
      >
        <option value="">All accessible projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <button className="rounded-md border px-4 py-2 text-sm" type="submit">
        Filter
      </button>
    </form>
  );
}
export async function FinanceNew({
  org,
  kind,
  requestId,
}: {
  org: string;
  kind: "payments" | "payment-requests";
  requestId?: string;
}) {
  const d = await financeData(
    org,
    kind === "payments" ? "payment.record" : "payment.request.create",
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title={kind === "payments" ? "Record payment" : "New payment request"}
        description="Amounts use the project currency or organization currency when no project is selected."
      />
      <FormCard title="Details">
        {kind === "payments" ? (
          <PaymentForm
            org={org}
            data={formData(d)}
            initialRequestId={requestId}
          />
        ) : (
          <RequestForm org={org} data={formData(d)} />
        )}
      </FormCard>
    </div>
  );
}
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
        <ul className="mt-4 space-y-2 text-sm">
          {row.bills.map((b) => (
            <li key={b.id}>
              <Link href={`/${org}/procurement/bills/${b.billId}`}>
                {d.bills.find((r) => r.id === b.billId)?.code ?? b.billId}
              </Link>{" "}
              · {money(b.amount)}
            </li>
          ))}
        </ul>
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
                })),
              }}
            />
          </FormCard>
          <ActionForm
            action={submitRequestAction.bind(null, org)}
            submit="Submit for approval"
          >
            <input type="hidden" name="id" value={id} />
          </ActionForm>
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
        {row.payments.map((p) => (
          <p key={p.id} className="py-2 text-sm">
            <Link
              className={linkClass}
              href={`/${org}/finance/payments/${p.id}`}
            >
              {p.code}
            </Link>{" "}
            · {money(p.amount)}
          </p>
        ))}
        {!row.payments.length && (
          <p className="text-sm text-muted-foreground">No posted payments.</p>
        )}
      </FormCard>
      <FormCard title="Approval timeline">
        <Link className={linkClass} href={`/${org}/approvals`}>
          Open approvals inbox
        </Link>
        {approvals.map((a) => (
          <div key={a.id} className="mt-4 text-sm">
            <p>
              {a.status} · {date(a.createdAt)}
            </p>
            <ol className="mt-2 space-y-2">
              {a.steps.map((s) => (
                <li key={s.id}>
                  {s.sequence}. {s.name} · {s.status}
                  {s.actedBy ? ` · ${s.actedBy.name}` : ""}
                  {s.comment ? ` · ${s.comment}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {!approvals.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Not submitted yet.
          </p>
        )}
      </FormCard>
    </div>
  );
}
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
        {row.allocations.map((a) => (
          <p key={a.id} className="py-2 text-sm">
            <Link
              className={linkClass}
              href={`/${org}/${a.vendorBillId ? `procurement/bills/${a.vendorBillId}` : `sales/invoices/${a.salesInvoiceId}`}`}
            >
              {a.vendorBill?.code ?? a.salesInvoice?.code}
            </Link>{" "}
            · {money(a.amount)} · {date(a.allocatedAt)}
          </p>
        ))}
        {!row.allocations.length && (
          <p className="text-sm text-muted-foreground">No allocations yet.</p>
        )}
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
            <ActionForm
              action={voidPaymentAction.bind(null, org)}
              submit="Void and reverse allocations"
              destructive
            >
              <input type="hidden" name="id" value={id} />
              <Field
                label="Reason for voiding"
                name="reason"
                required
                maxLength={1000}
              />
            </ActionForm>
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
export async function BalancesPage({
  org,
  projectId,
  type,
}: {
  org: string;
  projectId?: string;
  type?: string;
}) {
  const d = await financeData(org, "payment.view", projectId),
    balances = partyBalances(d, undefined, type);
  return (
    <div className="space-y-6">
      <PageHeading
        title="Party balances"
        description="Net position is receivables minus payables, plus vendor advances minus customer advances. Currencies remain separate."
      />
      <form className="grid max-w-xl gap-3 sm:grid-cols-3">
        <SelectField label="Party type" name="type" defaultValue={type ?? ""}>
          <option value="">Vendors and customers</option>
          <option value="vendor">Vendors</option>
          <option value="customer">Customers</option>
        </SelectField>
        <SelectField
          label="Project"
          name="projectId"
          defaultValue={projectId ?? ""}
        >
          <option value="">All accessible projects</option>
          {d.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <button
          type="submit"
          className="self-end rounded-md border px-4 py-2 text-sm"
        >
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Party",
                "Currency",
                "Billed",
                "Paid",
                "Payable",
                "Invoiced",
                "Received",
                "Receivable",
                "Vendor advance",
                "Customer advance",
                "Net",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={`${b.party.id}:${b.currency}`} className="border-t">
                <td className="p-3">
                  <Link
                    className={linkClass}
                    href={`/${org}/finance/balances/${b.party.id}?currency=${b.currency}${projectId ? `&projectId=${projectId}` : ""}`}
                  >
                    {b.party.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {b.party.isVendor ? "Vendor " : ""}
                    {b.party.isCustomer ? "Customer" : ""}
                  </p>
                </td>
                <td className="p-3">{b.currency}</td>
                {[
                  b.billed,
                  b.paid,
                  b.payable,
                  b.invoiced,
                  b.received,
                  b.receivable,
                  b.outgoingAdvance,
                  b.incomingAdvance,
                  b.net,
                ].map((v, i) => (
                  <td
                    key={
                      [
                        "billed",
                        "paid",
                        "payable",
                        "invoiced",
                        "received",
                        "receivable",
                        "vendorAdvance",
                        "customerAdvance",
                        "net",
                      ][i]
                    }
                    className="p-3 tabular-nums"
                  >
                    {money(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!balances.length && (
          <p className="p-6 text-sm text-muted-foreground">
            No approved documents or posted payments.
          </p>
        )}
      </div>
      <FormCard title="Outstanding aging by due date">
        <p className="mb-4 text-sm text-muted-foreground">
          Current includes undated and future-due documents. Buckets show days
          past due.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Party / currency",
                  "Side",
                  "Current",
                  "0–30",
                  "31–60",
                  "61–90",
                  "90+",
                ].map((h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.flatMap((b) =>
                [
                  { label: "Payable", values: b.payableAging },
                  { label: "Receivable", values: b.receivableAging },
                ].map((a) => (
                  <tr
                    key={`${b.party.id}:${b.currency}:${a.label}`}
                    className="border-t"
                  >
                    <td className="p-2">
                      {b.party.displayName} · {b.currency}
                    </td>
                    <td className="p-2">{a.label}</td>
                    {Object.entries(a.values).map(([bucket, value]) => (
                      <td key={bucket} className="p-2">
                        {money(value)}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </FormCard>
    </div>
  );
}
export async function StatementPage({
  org,
  partyId,
  currency,
  projectId,
}: {
  org: string;
  partyId: string;
  currency?: string;
  projectId?: string;
}) {
  const d = await financeData(org, "payment.view", projectId),
    party = d.parties.find((p) => p.id === partyId);
  if (!party) notFound();
  const currencies = [
    ...new Set(
      [...d.bills, ...d.invoices, ...d.payments]
        .filter((r) => r.partyId === partyId)
        .map((r) => r.currency),
    ),
  ];
  const selected =
    currency && currencies.includes(currency)
      ? currency
      : (currencies[0] ?? d.ctx.org.baseCurrency);
  const entries = partyStatement(d, partyId, selected);
  return (
    <div className="space-y-6">
      <PageHeading
        title={`${party.displayName} statement`}
        description={`Chronological activity in ${selected}. Positive balance is due from the party; negative balance is due to the party. Allocations do not change the net position.`}
      />
      <form className="flex max-w-sm items-end gap-3">
        <input type="hidden" name="projectId" value={projectId ?? ""} />
        <SelectField label="Currency" name="currency" defaultValue={selected}>
          {(currencies.length ? currencies : [selected]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <button className="rounded-md border px-4 py-2 text-sm" type="submit">
          Show
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {["Date", "Activity", "Debit", "Credit", "Running balance"].map(
                (h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{date(e.date)}</td>
                <td className="p-3">{e.description}</td>
                <td className="p-3">{new Decimal(e.debit).toFixed(2)}</td>
                <td className="p-3">{new Decimal(e.credit).toFixed(2)}</td>
                <td className="p-3 tabular-nums">{e.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && (
          <p className="p-6 text-sm text-muted-foreground">No activity.</p>
        )}
      </div>
    </div>
  );
}
