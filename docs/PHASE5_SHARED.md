# Phase V accounting contract

The user approved Phase V and the same implementation/preview workflow as Phase IV. Use GPT-6 Luna on `codex_codex_personal`, at most four concurrent subagents. Preserve all uncommitted Phase IV work. No remote database changes, automatic commits or deployments.

## Ledger rules

Accounting is organization-scoped and denominated in the organization's base currency. Project costing remains a separate operational ledger. Only POSTED journals enter financial reports. Every posted journal has at least two nonzero lines, exactly one debit or credit per line, and equal debit and credit totals. Validate money with Decimal at the base currency's precision, never JavaScript floating-point math.

Posted entries and lines are immutable. Corrections create exact opposite entries and, when appropriate, a replacement. Source edits reverse at the original source date, then replace at the revised source date. This is a retrospective correction policy; there are no period-close locks in this phase. Manual reversal dates cannot predate the original. Payment voids reverse at the later of the original date and the payment's updated UTC date.

Automatic source services share the caller's transaction and require no accounting permission beyond the independently authorized source operation. Manual accounting reads require accounting.view, account/configuration mutations accounting.manage, manual journal creation journal.create. Tenant-wide chart-template edits additionally require tenant OWNER/ADMIN. Always recheck organization ownership in service methods.

## Schema names and fields

- `AccountType`: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE.
- `JournalStatus`: DRAFT, PENDING_APPROVAL, POSTED, CANCELLED.
- `AccountTemplate`: id, tenantId, code, name, type AccountType, systemKey nullable String, active Boolean, createdAt, updatedAt. Unique tenant/code and tenant/systemKey. Tenant relation. Templates are cloned, not live-linked, into each organization.
- `LedgerAccount`: id, organizationId, templateId nullable, code, name, type AccountType, systemKey nullable String, active Boolean, createdAt, updatedAt. Unique org/code and org/systemKey, plus unique id/org for line ownership FK. Relations organization, template and journalLines. System account type/key cannot change or be disabled; custom account type cannot change after it has posted activity.
- `AccountingSource`: id, organizationId, sourceType String, sourceId String, revision Int default 0, fingerprint nullable String, currentEntryId nullable unique, createdAt, updatedAt. Unique org/sourceType/sourceId. Current-entry relation named CurrentSourceJournal; entries relation named SourceJournals. Records synchronize mutable documents without modifying posted history.
- `JournalEntry`: id, organizationId, code, date DateTime @db.Date, description, status JournalStatus default DRAFT, sourceType String default MANUAL, sourceDocumentId nullable String, accountingSourceId nullable, revision nullable Int, reversalOfId nullable unique, approvalRequestId nullable unique, createdById, postedById nullable, postedAt nullable DateTime, createdAt, updatedAt. Unique org/code and id/org; unique accountingSourceId/revision. Relations organization, creator, poster, lines, source via SourceJournals, currentForSource via CurrentSourceJournal, reversalOf/reversal via named JournalReversal self-relation, approvalRequest. No update/delete of POSTED rows. Reversal headers are new posted rows pointing to originals; originals remain POSTED.
- `JournalLine`: id, journalEntryId, organizationId, accountId, description default empty, debit Decimal(18,2) default0, credit Decimal(18,2) default0, projectId nullable, partyId nullable, taxComponentId nullable, taxName nullable, taxRate nullable Decimal(18,4), taxBaseAmount nullable Decimal(18,2). FK to journalEntry on [journalEntryId,organizationId], LedgerAccount on [accountId,organizationId]; optional project, party, tax component FKs. Nonnegative amounts, exactly one side positive. Parent entry must be DRAFT when changing lines. Index org/account/entry, project, party, component.

Add one NEW additive migration after Phase IV; never rewrite existing migrations. Include DB checks, line organization FKs, posted immutability and deferred posted-balance checks. Ordinary draft edits may replace lines, pending and posted lines cannot be edited. Do not place a DRAFT journal with an empty line through a constraint that prevents legitimate empty drafts; service draft saves require at least two valid lines.

## System chart

Export `SYSTEM_ACCOUNTS` from accounting/constants.ts, as objects `{key,code,name,type}`. Fixed keys/codes:

ASSET: CASH 1000, BANK 1010, VENDOR_ADVANCES 1020, ACCOUNTS_RECEIVABLE 1100, INPUT_TAX 1200, WITHHOLDING_RECEIVABLE 1210, INVENTORY 1300, TRANSFER_CLEARING 1310.
LIABILITY: ACCOUNTS_PAYABLE 2000, GRNI 2010, CUSTOMER_ADVANCES 2020, OUTPUT_TAX 2100, WITHHOLDING_PAYABLE 2110, PAYROLL_PAYABLE 2200, EXPENSE_PAYABLE 2300, COST_CLEARING 2400.
EQUITY: RETAINED_EARNINGS 3000, OPENING_BALANCE_EQUITY 3010.
INCOME: SALES_REVENUE 4000, FX_GAIN 4100.
EXPENSE: LABOUR_EXPENSE 5000, MATERIAL_EXPENSE 5010, EQUIPMENT_EXPENSE 5020, FUEL_EXPENSE 5030, ELECTRICITY_EXPENSE 5040, SUBCONTRACT_EXPENSE 5050, OVERHEAD_EXPENSE 5060, OTHER_EXPENSE 5070, COST_OF_GOODS_SOLD 5100, PURCHASE_VARIANCE 5110, FX_LOSS 5120, ROUNDING 5130.

`SystemAccountKey` is the key union. Users can add custom accounts; automatic mappings use these protected system keys. Ensure missing default tenant templates and org accounts lazily in transactions without overwriting customized names. Applying tenant templates to an existing organization is additive and idempotent. Never change an already-used account's type/key behind its journals.

## Inputs and pure helpers

`accounting/schema.ts` exports:

- `accountInput`: {id?:string, code:string, name:string, type:AccountType, active:boolean}.
- `templateInput`: same fields.
- `journalInput`: {id?:string,date:YYYY-MM-DD,description:string,lines:[{accountId,description:string,debit:decimalString,credit:decimalString,projectId:string|null,partyId:string|null}]}.
- `journalIdInput`: {id:string}.
- `reverseJournalInput`: {id:string,date:YYYY-MM-DD,reason:string}.
- `reportFiltersInput`: {from?:YYYY-MM-DD,to?:YYYY-MM-DD,accountId?:string,projectId?:string}. Ordered dates when both supplied. Balance-sheet uses `to`; P&L uses range; trial balance includes opening/movement/closing.

Decimal strings support at most two places; posting checks enforce actual base decimals. Date schemas return strings so RHF transformations occur only at the service boundary.

`accounting/util.ts` exports `validateJournalLines(lines,decimals=2)` returning `{debit,credit}` Decimals and rejecting unbalanced/zero/both-sided/negative/nonfinite/excess-precision lines; `accountBalance(type,debit,credit)` returns normal-signed Decimal; `allocateBaseAmounts(total,weights,decimals=2)` returns Decimal[] summing exactly to nonnegative total using largest remainder allocation; `reverseLines(lines)` returns opposite debit/credit preserving dimensions/tax snapshots. Helpers use InstanceType<typeof Decimal> for types, because core Decimal is a cloned constructor value.

## Journal engine API

Concrete server files. Services use Prisma.TransactionClient throughout; no root DB calls inside transaction helpers.

`server/chart-service.ts`: `ensureOrgChart(tx,organizationId,actorId)` returns Map<SystemAccountKey,LedgerAccount>; `saveAccount(tx,ctx,input)`; `saveTemplate(tx,ctx,input)`; `applyTemplates(tx,ctx)`.

`server/posting-service.ts`: `syncSourceJournal(tx,{organizationId,actorId,sourceType,sourceId,date,description,lines,reversalDate?})`; line format `{accountKey:SystemAccountKey,debit:Numeric,credit:Numeric,description?:string,projectId?:string|null,partyId?:string|null,taxComponentId?:string|null,taxName?:string|null,taxRate?:Numeric|null,taxBaseAmount?:Numeric|null}`. Empty lines mean remove active source posting through reversal. Dates accept Date; all are UTC calendar days. Returns current JournalEntry or null. Lock `accounting:${organizationId}` for consistent idempotency; canonical fingerprint includes date/description/resolved lines/dimensions/snapshots. Same fingerprint is a no-op. Replacement reverses current entry and posts a replacement under increasing source revisions. Reversal swaps taxBaseAmount sign as well, so tax summaries reverse correctly. Posted totals are checked before commit. Internal helpers may be split under posting-* files.

`server/journal-service.ts`: `saveJournal(tx,ctx,journalInput)`, `submitJournal(org,id)` using normal approval submission, `reverseJournal(tx,ctx,reverseJournalInput)`. Manual drafts only, no moving an entry between orgs. Submission uses JOURNAL, total debits in base currency, organization scope. Approval handler in `server/approval.ts` exports `journalApproval`; final approval posts once, rejection/cancel return to DRAFT. Automatic journals cannot be manually reversed; change/void their source instead. Manual reversals require accounting.manage, a reason, and date >= original; no reversal of reversal or duplicate reversal.

## Source posting rules

Sources are synchronized after domain writes inside the SAME transaction. Automatic calls do not load the approvals registry at module initialization.

- StockMovement GRN_IN: Dr INVENTORY / Cr GRNI, using accepted receipt base stock value. CONSUMPTION_OUT: Dr MATERIAL_EXPENSE / Cr INVENTORY. SALE_OUT: Dr COST_OF_GOODS_SOLD / Cr INVENTORY. TRANSFER_OUT: Dr TRANSFER_CLEARING / Cr INVENTORY. TRANSFER_IN: Dr INVENTORY / Cr TRANSFER_CLEARING. Stock is GL-valued independently of project cost-recognition mode. Use original movement project dimensions. Source type STOCK_MOVEMENT, id movement.id.
- Vendor bill: Dr GRNI for matched accepted receipt base accrual, Dr/Cr PURCHASE_VARIANCE for matched price/FX differences without stock revaluation, Dr OTHER_EXPENSE for direct/unmatched purchases, Dr INPUT_TAX, Cr ACCOUNTS_PAYABLE for basePayableTotal, Cr WITHHOLDING_PAYABLE. Invoice lines/taxes are frozen snapshots. Rejected quantities never created stock; their billed net cost goes to expense/variance rather than clearing nonexistent GRNI. Allocate base header totals consistently across lines/components; rounding residual only to ROUNDING and only within expected minor-unit bounds. Source VENDOR_BILL.
- Sales invoice: Dr ACCOUNTS_RECEIVABLE for basePayableTotal, Dr WITHHOLDING_RECEIVABLE, Cr SALES_REVENUE for baseGrandTotal-baseTaxTotal, Cr OUTPUT_TAX. Stock SALE_OUT is a separate movement journal, never another operational material cost journal. Source SALES_INVOICE.
- Payment creation: OUTGOING Dr VENDOR_ADVANCES / Cr CASH for CASH mode, BANK for other modes. INCOMING Dr CASH/BANK / Cr CUSTOMER_ADVANCES. Full stored payment baseAmount, source PAYMENT.
- PaymentAllocation: OUTGOING Dr AP at documentBaseAmount, Cr VENDOR_ADVANCES at baseAmount, Dr FX_LOSS if positive fxDifference or Cr FX_GAIN if negative. INCOMING Dr CUSTOMER_ADVANCES at baseAmount, Cr AR at documentBaseAmount, Cr FX_GAIN if positive difference or Dr FX_LOSS if negative. Source PAYMENT_ALLOCATION. Effective date is max(payment date, document date, allocatedAt UTC day), preserving actual advance timing.
- Fully allocated payment rounding: if sum allocation baseAmount differs from payment baseAmount, clear the residual advances against ROUNDING in a separate PAYMENT_ROUNDING source at the last allocation date. Outgoing signed delta=sumAllocatedBase-paymentBase: Dr VENDOR_ADVANCES / Cr ROUNDING; incoming opposite. Limit residual to plausible per-allocation rounding. Partial payments have no rounding-clear entry. On void reverse payment, allocations and rounding at max(original date, payment updatedAt UTC day). Historical voids first imported should retain original and reversal history, not silently disappear.
- Attendance cost: Dr LABOUR_EXPENSE / Cr PAYROLL_PAYABLE using the CostEntry baseAmount. Expense approved cost: Dr cost-type expense / Cr EXPENSE_PAYABLE. Asset costs: Dr equipment/fuel/electricity expense / Cr COST_CLEARING, an explicit accrual/management-cost clearing account because those operational logs do not record a cash settlement. Use CostEntry baseAmount for these sources; DO NOT also post GRN, consumption, transfer or bill-variance CostEntry rows, which have dedicated GL source rules. Source type COST_ENTRY, sourceId costEntry.id. Edits and removals sync/reverse before cost deletion, under the existing source transaction.

Source adapter entry points and ownership will be assigned in PHASE5_API.md. Provide an explicit, idempotent organization history synchronization action to post existing source documents. It must require accounting.manage; no background history mutation on page reads. Existing approved bills/invoices and stock movements, active/void payments, allocations and eligible CostEntry sources are included. Draft/unapproved documents never post.

## Reports and UI

Routes: /[org]/accounting/accounts, /journals, /journals/[id], /ledger, /trial-balance, /profit-loss, /balance-sheet, /tax. Sidebar Accounting group, permissions accounting.view. Journal creator without accounting.view may reach their manual journal route/list with journal.create but must not gain general financial-report visibility. Account config needs accounting.manage; tenant templates additionally tenant admin. Manual drafts have edit/submit; posted manual has reversal; automatic journals link to source where practical. Approval inbox JOURNAL links route detail.

Ledger has opening balance, ordered date/code/line activity and running balance, with account/date filters. Trial balance includes opening debits/credits, period movements and closing balances and an equality check. P&L shows INCOME credits-minus-debits and EXPENSE debits-minus-credits, net profit. Balance sheet sums ASSET/LIABILITY/EQUITY as of to, adding cumulative retained profit from all income/expense postings to equity; expose an imbalance, never hide it. Tax report groups posted tax snapshot lines by component/rate/input-output-withholding accounts, with debit/credit/net and source drilldown. These are accounting tax summaries, not jurisdiction-specific filing forms.

Reuse existing shared forms/tables/overlays, Promise route params inside Suspense, concrete module imports and adjacent tests. Read relevant installed Next docs before route/actions edits. No new dependencies. Use UTC date labels, accessible form errors, narrow-screen table scrolling and the existing visual system.
