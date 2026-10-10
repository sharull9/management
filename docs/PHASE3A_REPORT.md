# Phase 3a implementation report

Implemented on `build/foundation`. Phase 3b remains pending. No push was performed.
The placeholder `.env` was preserved; local database URLs were supplied only through shell
environment variables. Generated Prisma files and stored uploads are excluded from commits.

## Built

- Tenant masters at `/[org]/masters/uoms`, `categories`, `levels`, `items`, `parties` and `tax`.
  System UOM rows are read-only. Tenant groups have one base unit, enforced by database checks
  and a partial unique index. Categories validate cycles and a maximum depth of five.
- Five configurable item levels, enabled flags, values, NOT_USED/ANY/LINKED configurations,
  required flags and linked-value restrictions. The shared item picker resolves variants with
  deterministic keys and readable names. Items expose stock/purchase UOMs, categories, tax
  defaults, tracking and active flags. SERVICE defaults to untracked; other item types default
  to tracked in the form. Referenced stock settings and conversion factors cannot be changed.
- Parties with vendor/customer flags, payment terms, credit limits, addresses, contacts and tax
  identifiers. Existing quick customer creation uses the same Party records and links to this UI.
- Purchase/sales/both tax applicability, withholding components, group scope and country,
  two-decimal half-up snapshots and state-based INTRA/INTER suggestions. Known conflicting
  purchase tax scopes are rejected by the server.
- Twelve models: PurchaseRequest, PurchaseRequestLine, PurchaseOrder, PurchaseOrderLine,
  PurchaseOrderLineTax, GoodsReceipt, GoodsReceiptLine, StockMovement, MaterialConsumption,
  MaterialConsumptionLine, StockTransfer and StockTransferLine. Three migrations extend masters,
  add procurement/inventory relations and enforce quantities, rates, splits and ledger signs.
- `/[org]/procurement/requests`, `orders` and `receipts`, with document detail routes, draft
  editing, multi-line forms, project filters, status, totals, tax breakdown and approval timelines.
  Orders can allocate approved PR lines or be entered directly. Allocation checks prevent
  ordering more than the converted PR quantity. PO quantities received and accepted are separate.
- `/[org]/inventory/stock`, `consumption`, `transfers` and transfer detail. Project Materials tabs
  show project PRs/POs/GRNs, balances, consumption history and a scoped consumption form.
- Procurement and Inventory navigation groups, permission-aware forms and queries, meaningful
  approval titles/links, printable PO CSS and private proforma uploads/downloads through the
  existing Attachment and storage abstractions. Proformas accept PDF/PNG/JPEG up to 900 KB.
- Zod actions, existing ActionResult/form conventions, transactional numbering (PR/PO/GRN/MC/ST),
  audit trails and project ownership checks. Runtime page reads are covered by Suspense.
- Reusable modules in `src/server/masters`, `src/server/procurement` and `src/server/inventory`.
  Local-only smoke fixture and verification scripts are under `scripts/phase3a-smoke-*.ts`.

## Approval wiring

The deterministic registry registers PURCHASE_REQUEST, PURCHASE_ORDER, GRN and STOCK_TRANSFER
handlers. Submission lives separately from registration to avoid a service/registry import cycle.
Existing policy selection, manager resolvers, amount thresholds and decision transactions are reused.
PR estimated total and PO grand total are passed into the approval request. Final handlers verify
the pending source and matching approval request before posting effects.

- PR approval approves its lines; rejection/cancellation returns the document and lines to draft.
- PO approval enables receiving. Rejection/cancellation returns the order to draft.
- GRN approval locks the order and project stock, checks cumulative receipts, posts accepted stock
  and updates PO line totals and PARTIALLY_RECEIVED/RECEIVED status in the engine transaction.
- Transfer approval locks both projects in stable order, rechecks availability and posts balanced
  movements. Rejection/cancellation returns the transfer to draft without stock effects.
- Consumption has no approval step. Its stock, MATERIAL costs and audit entries share one transaction.

Project managers and scoped custom roles use the existing DAL. Org-wide lists include only projects
visible for the module permission. Transfers require access to both projects. Master mutations
require masters.manage; new create/consume/transfer/view permissions are explicit.

## Stock and costing rules

`MATERIAL_COST_RECOGNITION = "ON_CONSUMPTION"` is the single declared recognition rule.
GRNs post no CostEntry. Accepted receipt quantity converts to stock UOM using the PO snapshot;
unit cost is the discounted PO net rate divided by its stock conversion factor, excluding configured
purchase taxes. Rejected quantity creates no inventory. Physical received quantity, including
rejections, determines order completion; accepted quantities remain separately visible.

Consumption posts a negative stock movement at weighted-average cost and one MATERIAL CostEntry
per line with source CONSUMPTION. Transfers post equal opposite quantity/value at source average
cost and no CostEntry. Stock queries return quantity, average cost and value per project/variant.
Movement values retain eight decimals; CostEntry amounts round half-up to two. Full depletion clears
the remaining value exactly. Advisory project locks serialize postings and protect against overspend.

Conversions require the same UOM group and an exact result within four quantity decimals. Default
receipt tolerance is zero; the pure guard supports a configured tolerance. Stock postings cannot
precede a later movement for the same project/variant; same-day entries follow posting order.

## Verification

Final required gates all passed:

- `pnpm prisma validate`
- `pnpm prisma generate`
- `pnpm exec tsc --noEmit`
- `pnpm format`
- `pnpm lint`
- `pnpm test`: 17/17 tests, including six new calculation/variant tests.
- `pnpm build`: passed with the placeholder DATABASE_URL; requested runtime routes were built
  with partial prerendering and 44 static shells.
- `git diff --check`
- Next dev MCP `get_compilation_issues` and `get_errors`: empty issue/error lists.

New tests cover required/linked/unused variant levels, UOM groups and precision, GST snapshots,
half-up rounding, purchase applicability, withholding, INTRA/INTER/unknown state suggestions,
invalid tax totals, cumulative over-receipt/tolerance and weighted-average/full-depletion costing.

### Browser and database smoke

Used isolated `pnpm prisma dev --name management-phase3a --detach` on localhost port 51237.
All three new migrations and seed completed. No reset or changes to the placeholder `.env`.
The T3 collaborative browser performed actual forms and approval actions:

1. Defined Brand/Grade, UltraTech/53 Grade and BAG50 (50 kg). Created Cement with kg stock,
   bag purchasing, required linked Brand and required ANY Grade; created a vendor with Tamil Nadu
   address and CGST 9% + SGST 9% INTRA group.
2. PR-0001: 20 bags at estimated 400, total 8,000; submitted and approved.
3. PO-0001: linked PR, 20 bags at 400, credit 30 days and project site. Subtotal 8,000,
   tax 1,440, grand total 9,440; submitted and approved.
4. GRN-0001: eight bags accepted (400 kg); GRN-0002: twelve bags accepted (600 kg).
   Both approved. PO became RECEIVED; stock was 1,000 kg at average 8, value 8,000.
5. MC-0001: consumed 100 kg against Foundation / Pour Concrete. MATERIAL cost 800 appeared
   in overview (8% of 10,000 budget); stock became 900 kg, value 7,200.
6. ST-0001: approved transfer of 200 kg to the second project. Source 700 kg/value 5,600;
   destination 200 kg/value 1,600. No transfer cost entries and no pending approvals.
7. Read-only scoped user saw only the source project in stock/PO lists and had no creation or
   consumption forms. Source Materials displayed stock and history.
8. Uploaded a small PNG proforma using the actual action. Authorized private download returned
   HTTP 200, image/png, 68 bytes and Cache-Control private,no-store.

`scripts/phase3a-smoke-verify.ts` independently checked persisted documents, movements, cost
uniqueness and audits. Negative checks passed for insufficient stock, backdating, mismatched
stage/project, cross-project PR allocation, duplicate GRN decisions, completed-PO receipt and
invalid linked Brand. Variant resolution was idempotent; failed operations added no ledger rows.

Additional transaction-isolated scenarios passed, then deliberately rolled back: a 10%-discounted
two-bag order (900 net + 162 GST = 1,062), accepted/rejected split (75 kg accepted at 9), cumulative
over-receipt rejection, GRN rejection back to draft, transfer into existing stock (250 kg/value 2,050,
average 8.2) and full depletion. Baseline smoke balances remained unchanged.

### Command and recovery log

Repeated executions are grouped; failures below were corrected before the final gates.
Read-only repository inspection used git status/branch/log/diff, rg and Get-Content. Mandatory
PLAN, README, Phase 2 report, AGENTS and relevant installed Next docs were read. Two guessed Next
cache guide paths did not exist; the installed caching guide was located and read instead.

- Prisma format/validate/generate: PASS. Initial TypeScript checks found form option and attachment
  field mismatches; corrected, then PASS. Initial Biome checks found keys/import/style issues and
  temporary helper files; corrected/removed, then final format and lint PASS.
- Named local Prisma dev start/list/help: PASS. Initial migrate dev and seed: PASS. Integrity
  migration first failed in shadow validation because PowerShell wrote a UTF-8 BOM; removed the
  BOM before application and reran successfully. Master defaults migration ultimately PASS.
- The local Prisma dev daemon intermittently returned P2039 bind mismatches, ECONNRESET,
  ConnectionClosed/P1017 and P1001 during overlapping browser/CLI access. Inspected local process
  and port state and restarted only the named instance. One restart encountered its stale lock;
  a subsequent start succeeded. Migrations, seed and verifier then PASS with existing data intact.
- Fixture: `pnpm exec tsx scripts/phase3a-smoke-fixture.ts` with local-only confirmation/password
  environment variables, PASS. A preliminary raw Invoke-WebRequest sign-in returned 400;
  browser sign-in and actual authenticated actions PASS.
- Verifier: `node --conditions=react-server --import tsx scripts/phase3a-smoke-verify.ts`, PASS.
  A transient closed-connection run failed before daemon recovery; rerun PASS. An attempted direct
  query-module import under react-server CLI conditions failed on React.createContext through Next;
  removed that unsuitable check and verified scoped visibility in the real browser instead.
  Prisma/pg emitted a deprecated concurrent client.query warning during relation reads; assertions passed.
- Native browser interactions: final workflow PASS. Early hydration/DOM/evaluation retries were
  corrected. Initial PR rendering exposed the registry import cycle; separated submission from
  handler registration and repeated the flow successfully. Final Next MCP diagnostics PASS.
- Unit tests: initial 16/16 PASS; added invalid-tax case, final 17/17 PASS. Production builds PASS.
  Final formatting/lint/typecheck/schema generation/build and diff checks PASS.

## Deviations and boundaries

- Transfers require the same project currency; FX valuation is deferred. Backdated stock entries
  are rejected rather than replaying historical weighted-average costs.
- GRNs receive in the PO line unit, then convert accepted quantity to stock units. Purchase taxes
  are treated as recoverable for receipt costing in this phase; nonrecoverable taxes, bill price
  variance and revaluation need an explicit Phase 3b treatment.
- A PO becomes received based on physical receipts including rejected units. Replacements beyond
  ordered quantities require a tolerance or another order; they are not silently accepted.
- Referenced UOM factors/group and item stock configuration are immutable to preserve historical
  conversion integrity. A group base is retained until the unused group is deleted.
- CLOSED/CANCELLED PO and ADJUSTMENT ledger enum values are reserved. This run does not add
  terminal PO close/cancel or stock-adjustment UI. Pending approval cancellation returns drafts.
- Proforma upload size stays within the existing server-action body limit. Categories use parent
  selection with validated hierarchy rather than a drag-and-drop tree editor.
- Core browser workflow, scoped-reader visibility, pure calculations and transaction failure cases
  were tested. This is not exhaustive load/concurrency testing, every CRUD permutation, multi-step
  policy UI testing or print-export verification. Existing engine tests remain passing.

## Remaining Phase 3b

Vendor bills (including GRN matching and variance treatment), payments, advances, sales documents,
receipts and their approval/posting flows remain unbuilt. PO/GRN lines, tax snapshots, attachments,
party roles, project currency and source IDs provide the attachment points. No production deployment
or push was performed.
