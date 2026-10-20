# Phase V implementation interfaces and ownership

All paths below are relative to `src/modules/accounting`. Read PHASE5_SHARED.md for the accounting rules. Preserve each owner's files during parallel work; report interface issues to the coordinator. No agent spawns children.

## Engine and account part

Own `server/chart-service.ts`, `server/posting-service.ts`, `server/posting-*.ts`, `server/journal-service.ts`, `server/approval.ts`, `server/actions.ts`, and adjacent focused tests. Exact service API is in SHARED.md. `syncSourceJournal` accepts system-key lines and may return null. `ensureOrgChart` returns a Map keyed by the fixed system keys.

Actions, all typed and independently authenticated:

- `saveAccountAction(org,input:accountInput)` and `saveTemplateAction(org,input:templateInput)`.
- `applyTemplatesAction(org,input:{})` initializes the chart or adds missing active templates, idempotently.
- `saveJournalAction(org,input:journalInput)` saves a balanced manual draft and returns a redirect to `/${org}/accounting/journals/${id}` through the existing ActionState convention.
- `submitJournalAction(org,input:{id})` submits the draft through JOURNAL approvals.
- `reverseJournalAction(org,input:reverseJournalInput)` posts a manual reversal and redirects to its new journal.

Use `JRN` document numbering for every manual/automatic/reversal journal. Do not register approval handlers from engine files or eagerly import the approval service. `journalApproval` is registered by the coordinator in the existing registry. Use dynamic imports at submission time to avoid cycles. Helpers may be split to stay around 400 lines per file.

## Purchasing, sales and inventory adapter part

Own `server/source-procurement.ts`, `server/source-sales.ts`, `server/source-stock.ts`, `server/source-tax.ts`, `server/source-invoice-*.ts` as needed, pure `invoice-postings.ts` and adjacent tests. Own small hook edits to:

- `vendor-bill/server/approval.ts` after approved status is saved.
- `sales-invoice/server/approval.ts` after invoice approval status, and `sales-invoice/server/stock.ts` after stock movement creation.
- `procurement/server/receipt-approval.ts`, `procurement/server/transfer-approval.ts`, `procurement/server/inventory/service.ts` after stock movement creation.

Exact exports:

- `syncStockMovementJournal(tx,organizationId,movementId,actorId)` from source-stock.ts.
- `syncVendorBillJournal(tx,organizationId,billId,actorId)` from source-procurement.ts.
- `syncSalesInvoiceJournal(tx,organizationId,invoiceId,actorId)` from source-sales.ts.

Include frozen tax snapshots with system-key input/output/withholding lines. Net/base totals and any small rounding residual must reconcile exactly; largest-remainder helper allocates header totals across components. Never post operational material CostEntry rows again. Accepted receipt values alone clear GRNI; bills without accepted receipts post to expense. Purchase variance is an expense, not historical inventory revaluation. No source lock reversals or independent transactions.

## Cash and cost adapter part

Own `server/source-payments.ts`, `server/source-costs.ts`, related pure payment-postings.ts/tests, and small hook edits to:

- `payment/server/{payment-service,allocation-service,void-service}.ts` after final domain state writes.
- `attendance/server/service.ts` after CostEntry upsert and before CostEntry deletion.
- `project-cost/server/approval.ts` after approved CostEntry upsert.
- `assets/server/log-ledger.ts` after CostEntry upsert and before deletion.

Exports:

- `syncPaymentJournals(tx,organizationId,paymentId,actorId)` from source-payments.ts. Handles original payment, each allocation, rounding and voids. Every source journal uses the same transaction. Active retries are no-ops; voids preserve original and exact reversals. See SHARED.md for allocation timing and signs.
- `syncCostEntryJournal(tx,entry,actorId)` from source-costs.ts, where entry is a generated Prisma CostEntry row. It checks the source allowlist ATTENDANCE, EXPENSE, ASSET_TRIP, ASSET_USAGE, ASSET_ELECTRICITY, ASSET_FUEL. Other source types are no-ops.
- `removeCostEntryJournal(tx,organizationId,costEntryId,actorId)` reverses the active COST_ENTRY journal before source deletion. Idempotent.

## Queries, history and reporting part

Own `server/queries.ts`, `server/reports.ts`, `server/history-service.ts`, `server/history-actions.ts`, `report-util.ts` and adjacent tests. No source/engine/action files owned by other parts. Return these exact query shapes:

- `accountsData(org)`: `{ctx,accounts,templates,canManage,canManageTemplates,canCreate,canView}`. Arrays are Prisma rows; templates only returned to authorized tenant admins. Read-only page loads never initialize charts or synchronize history.
- `journalsData(org)`: `{ctx,journals,canCreate,canManage,canView}`. Journal rows include creator, reversal and reversalOf relations as needed. A journal.create-only user sees only their own MANUAL entries. An accounting.view user sees all org journals. Do not expose automatic journal details to journal.create-only users.
- `journalData(org,id)`: `{ctx,journal,accounts,projects,parties,canEdit,canSubmit,canReverse,canView}`. Journal includes lines with account/project/party and reversal/reversalOf. Creator can read own manual journal with journal.create. Pending assigned approvers can read this specific JOURNAL via canActOnStep without gaining report visibility. Others need accounting.view or admin. Accounts/projects/parties are safe same-org/tenant choices for editing; canEdit/Submit only DRAFT own journal.create or admin/accounting.manage as appropriate, canReverse only POSTED MANUAL with no reversal and accounting.manage.
- `reportsData(org,filters)` from server/reports.ts: `{ctx,accounts,filters,trialBalance,profitLoss,balanceSheet,ledger,tax}`. Full accounting.view required. Serialize report amounts to decimal strings. Chart/account/source metadata on journal lines stays same-org. Use exact report shape below.

Report data shapes:

- trialBalance `{rows:[{accountId,code,name,type,openingDebit,openingCredit,periodDebit,periodCredit,closingDebit,closingCredit}],debitTotal,creditTotal,difference}`.
- profitLoss `{income:[{accountId,code,name,amount}],expenses:[same],totalIncome,totalExpenses,netProfit}`.
- balanceSheet `{assets:[{accountId,code,name,amount}],liabilities:[same],equity:[same],totalAssets,totalLiabilities,equityBeforeProfit,retainedProfit,totalEquity,difference}`. Retained profit is cumulative income less expenses through `to`, independent of `from`.
- ledger `{accountId:string|null,openingBalance,rows:[{id,journalId,code,date:string,description,debit,credit,balance}],closingBalance}`. Default first account with activity, otherwise first chart account; ordering date/code/line id. Normal-signed balance consistent with account type.
- tax `{rows:[{key,name,rate:string|null,accountKey,baseAmount,debit,credit,net}],totalDebit,totalCredit}`. Group posted tax snapshot lines by component/name/rate/system tax account; support input/output and withholding. Reversals must cancel both money and tax base. No filing/compliance claims.

`syncAccountingHistory(tx,ctx)` in history-service.ts requires accounting.manage and returns `{sources:number}`. Ensure chart, iterate all existing stock movements, approved/partially paid/paid bills and invoices, every payment including voids, eligible CostEntries. Call exact adapter exports above. Avoid double counting and use engine idempotency. `syncHistoryAction(org,input:{})` wraps it in an authorized transaction with a generous timeout. It is explicit UI action, never a report-read side effect.

## UI forms part

Own `ui/components/account-form.tsx`, `journal-form.tsx`, `journal-actions.tsx`, `history-sync-button.tsx`, `report-filters.tsx`, plus form-specific helper/tests. Screens owned separately. Exact props:

- `AccountForm({org,template?:boolean,account?})`; account is raw accountInput fields. Uses saveTemplateAction when template true.
- `JournalForm({org,baseCurrency,accounts,projects,parties,journal?})`; choices are `{id,code,name}[]` for accounts, `{id,name}[]` for projects/parties. Journal is raw journalInput. Dynamic lines with description, debit/credit, optional project/party; show balance and accessible errors. All amounts are strings. Save action validates base precision; defaults at least two rows.
- `JournalActions({org,id,status,canSubmit,canReverse})`; submit typed action, reverse via existing SideSheet containing date/reason confirmation; no direct approval bypass. Reverse date defaults UTC today.
- `HistorySyncButton({org})` calls syncHistoryAction. Also export `ApplyTemplatesButton({org})` in same file calls applyTemplatesAction. Existing toast/loading/error patterns.
- `ReportFilters({accounts,accountFilter?:boolean})`; accounts `{id,code,name}[]`; URL-based from/to and optional accountId using existing FilterBar/shared date fields. Screens parse URL filters through reportFiltersInput.

Follow UI_KIT, shadcn, existing visual system, RHF ActionFormShell/useZodForm and thin client boundaries. No Prisma Decimal/Date passed to client components. Read installed Next docs before actions or route edits.

## UI screens part

Own `ui/views/**`, table components outside form-owned names, accounting route adapters, sidebar Accounting group + nav tests. Routes in SHARED.md. Use exact queries/forms above, permission gates and explicit initialize-chart/history actions. Account screen includes organization chart and tenant template section where authorized. Journals detail includes balanced lines, approval timeline via existing shared component, source/reversal references and draft editing/submit/reverse controls. Financial reports show equality checks and clear empty states, dates and base currency. Read-only users get no mutations. Mobile tables scroll inside their container.

## Coordinator-owned integration

Approval registry + regression test, JOURNAL document link, base-currency lock checks, architecture/README/plan/report docs and final verification. Source hooks and engine helpers must not touch these files. Opt-in database tests will be assigned separately after the services exist.
