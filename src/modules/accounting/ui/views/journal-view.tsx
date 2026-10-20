import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovalTimeline } from "@/components/shared/approval-timeline";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge } from "@/components/shared/status-badge";
import { Decimal } from "@/core/decimal";
import { formatMoney } from "@/core/format";
import { journalData } from "../../server/queries";
import { AccountingTable } from "../components/accounting-table";
import { JournalActions } from "../components/journal-actions";
import { JournalForm } from "../components/journal-form";
import { journalApprovalView } from "./journal-approval-view";

export async function JournalView({ org, id }: { org: string; id: string }) {
  const data = await journalData(org, id);
  if (!data.journal) notFound();
  const { journal } = data;
  const currency = data.ctx.org.baseCurrency;
  const totals = journal.lines.reduce(
    (sum, line) => ({
      debit: sum.debit.add(line.debit),
      credit: sum.credit.add(line.credit),
    }),
    { debit: new Decimal(0), credit: new Decimal(0) },
  );
  const lines = journal.lines.map((line) => ({
    id: line.id,
    account: `${line.account.code} ${line.account.name}`,
    description: line.description || "—",
    project: line.project?.name ?? "—",
    party: line.party?.displayName ?? "—",
    debit: formatMoney(line.debit, currency),
    credit: formatMoney(line.credit, currency),
  }));
  const approvals = journal.approvalRequest
    ? journalApprovalView(journal.approvalRequest)
    : [];
  const draft = {
    id: journal.id,
    date: journal.date.toISOString().slice(0, 10),
    description: journal.description,
    lines: journal.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
      projectId: line.projectId,
      partyId: line.partyId,
    })),
  };
  return (
    <>
      <PageHeading
        title={journal.code}
        description={`${journal.date.toISOString().slice(0, 10)} · ${journal.description} · ${currency}`}
        actions={
          <>
            <StatusBadge status={journal.status} />
            <JournalActions
              org={org}
              id={journal.id}
              status={journal.status}
              canSubmit={data.canSubmit}
              canReverse={data.canReverse}
            />
          </>
        }
      />
      {(journal.sourceType !== "MANUAL" || journal.sourceDocumentId) && (
        <p className="text-sm text-muted-foreground">
          Source:{" "}
          {journal.sourceDocumentId &&
          ["VENDOR_BILL", "SALES_INVOICE"].includes(journal.sourceType) ? (
            <Link
              className="underline"
              href={
                journal.sourceType === "VENDOR_BILL"
                  ? `/${org}/procurement/bills/${journal.sourceDocumentId}`
                  : `/${org}/sales/invoices/${journal.sourceDocumentId}`
              }
            >
              {journal.sourceType.replaceAll("_", " ")}{" "}
              {journal.sourceDocumentId}
            </Link>
          ) : (
            `${journal.sourceType.replaceAll("_", " ")}${journal.sourceDocumentId ? ` · ${journal.sourceDocumentId}` : ""}`
          )}
        </p>
      )}
      {journal.reversal && (
        <p className="text-sm">
          Reversed by{" "}
          <Link
            className="underline"
            href={`/${org}/accounting/journals/${journal.reversal.id}`}
          >
            {journal.reversal.code}
          </Link>
        </p>
      )}
      {journal.reversalOf && (
        <p className="text-sm">
          Reversal of{" "}
          <Link
            className="underline"
            href={`/${org}/accounting/journals/${journal.reversalOf.id}`}
          >
            {journal.reversalOf.code}
          </Link>
        </p>
      )}
      {data.canEdit && (
        <FormCard title="Edit draft">
          <JournalForm
            org={org}
            baseCurrency={currency}
            accounts={data.accounts}
            projects={data.projects}
            parties={data.parties.map((p) => ({
              id: p.id,
              name: p.displayName,
            }))}
            journal={draft}
          />
        </FormCard>
      )}
      <FormCard
        title="Journal lines"
        description={`${journal.sourceType === "MANUAL" ? "Manual entry" : "Automatic source entry"} · Created by ${journal.creator.name}`}
      >
        <AccountingTable
          rows={lines}
          columns={[
            { key: "account", label: "Account" },
            { key: "description", label: "Description" },
            { key: "project", label: "Project" },
            { key: "party", label: "Party" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
          ]}
        />
        <p className="mt-3 text-right text-sm font-medium">
          Debits {formatMoney(totals.debit, currency)} · Credits{" "}
          {formatMoney(totals.credit, currency)}
        </p>
      </FormCard>
      {journal.approvalRequest && (
        <ApprovalTimeline org={org} approvals={approvals} variant="sales" />
      )}
    </>
  );
}
