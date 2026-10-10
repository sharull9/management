# Phase 3b sales implementation

Agent D, wave 2, on `build/foundation`. Changes are confined to sales server code,
invoice routes, sales components and this report. No push, schema change, migration,
Prisma generation, repository-wide formatting or build was performed.

## Routes and screens

- `/[org]/sales/invoices`: customer, project, status and overdue filters; invoice code,
  customer, project, invoice/due dates, currency/grand total, received total, payable
  balance and status. `?projectId=...` adds a read-only project Billing summary of
  approved invoices in the current filters, grouped by currency.
- `/[org]/sales/invoices/new`: optional project, project-client customer default,
  customer payment-term due date, place of supply, notes and editable lines.
- `/[org]/sales/invoices/[invoiceId]`: line detail, individual tax snapshots,
  totals, approval timeline, posted incoming PaymentAllocation receipts, draft
  editing and submission. Browser Print/PDF uses a dedicated invoice print view
  with organization legal name/tax identifiers, customer legal name/billing
  address/tax identifiers, dates, place of supply, lines, taxes and totals.

All runtime route reads, including promised params/searchParams, are inside an
explicit Suspense boundary. Existing loading.tsx remains in place. No project
page or navigation changes were needed.

## Validation, authorization and totals

Server actions use zod, ActionState/runAction, org/project DAL checks and
`sales.invoice.create`. Reads use `sales.view`; project lists use the existing
moduleProjectWhere helper. Org invoices require the org permission; project
invoices also require project access. Edits authorize both the original and new
project, lock the invoice and verify its original project has not changed while
authorization was being resolved. Submission locks and re-reads the invoice.

Customers must be tenant-owned isCustomer parties. Project client defaults are
applied in the form and server service. Currency comes from the project, or the
organization base currency for invoices without a project. Blank due dates use
customer paymentTerms days; dates cannot precede the invoice date. Customer
address selection prefers isDefault, matching the existing master model's lack
of a separate billing-address classification.

Lines use the existing ItemPicker and selectedVariant resolver for products,
raw materials and services, or allow a free-text description with a tenant/system
UOM. Free-text descriptions are required. Item UOMs must belong to the stock UOM
group. Stock flags require a project and stock-tracked goods variant; services,
untracked items and free-text lines cannot withdraw stock.

Tax scopes reuse suggestTaxScope from procurement, comparing organization state
with place of supply. Place of supply defaults to the customer's preferred address.
Known conflicting tax scopes and country mismatches are rejected. Tax groups and
components are tenant-scoped. calculateTax is imported and invoked for SALES,
so purchase-only components are excluded. Component names, rates, amounts and
withholding flags are snapshotted on each draft save.

All financial arithmetic uses the shared high-precision Decimal/money helpers.
Each line's gross subtotal rounds half-up to two places, then its discount rounds
half-up; the discounted base and tax snapshots determine its lineTotal. Document
subtotal is gross, discountTotal is separate, grandTotal = subtotal - discountTotal
+ taxTotal, and payableTotal = grandTotal - withholdingTotal. Received total is
initialized to zero only when creating the invoice. This module never updates
receivedTotal or settlement status. Balance uses payableTotal minus receivedTotal,
so customer withholding is not presented as money still owed.

## Approval and inventory

Submission creates a SALES_INVOICE request for grandTotal using submitForApproval
and changes the draft to PENDING_APPROVAL. Handler export names and signatures
remain unchanged. Matching document, organization, approvalRequestId and pending
status guards apply to final decisions. Rejection/cancellation returns to DRAFT;
resubmission preserves the previous approval requests for the timeline.

Final approval posts every fromProjectStock line inside the approval engine's
transaction, then sets APPROVED. sales/stock.ts reads/writes Prisma directly:

- Uses the same `stock:<orgId>:<projectId>` PostgreSQL advisory transaction lock
  as inventory, serializing against receipts, consumption and transfers.
- Revalidates project/org currency, item tenant and stock eligibility.
- Rejects a movement date earlier than an existing movement for that variant.
- Converts line quantities with procurement's convertUom helper; incompatible
  units or conversions exceeding four quantity decimals fail.
- Aggregates current movement quantity/value for each line, including earlier
  lines in the same approval, then uses movingAverage to block overselling and
  calculate negative SALE_OUT quantity/value at current average cost.
- Full depletion clears remaining inventory value exactly. Movement unitCost
  and totalCost retain the shared eight-decimal precision.
- Links the resulting movement through SalesInvoiceLine.stockMovementId, using
  sourceType SALES_INVOICE and sourceId = invoice line ID.
- Records document and stock movement audit entries with the decision actor.

Any failure rolls back approval effects and prior line postings together. Approval
request locking plus pending-status guards prevent duplicate final effects.

Sales creates no CostEntry. Revenue and COGS journal treatment is deferred to
phase 5 accounting as requested. The outgoing stock value is retained in SALE_OUT
for that future accounting work; neither existing material recognition behavior
nor project cost ledger entries are adjusted by sales.

## Files

- `src/server/sales/actions.ts`, `service.ts`, `queries.ts`, `validation.ts`
- `src/server/sales/calculations.ts`, `calculations.test.ts`, `stock.ts`, `approval.ts`
- `src/components/sales/invoice-form.tsx`, `pages.tsx`
- Existing invoice list/new/detail page.tsx files replaced within the owned routes.
- `docs/PHASE3B_SALES.md`

Existing sales/index.ts continues to re-export the handler contract unchanged.

## Verification and integration follow-up

- `node --import tsx --test src/server/sales/calculations.test.ts`: PASS, 8/8.
  Covers discount/GST/TDS totals, sales applicability, rounding identities,
  invalid money, excessive withholding, scope suggestions, stock eligibility,
  stock conversion/overselling/depletion, overdue dates and zod date/quantity bounds.
- `pnpm test`: PASS, 17/17 existing tests.
- `pnpm exec tsc --noEmit`: initial checks passed. A later check reported only
  four errors in agent C's in-progress `src/server/payments/service.test.ts`:
  TS2305 at line 2 for node:module registerHooks and TS7006 at line 11 for
  specifier, context and nextResolve. No sales TypeScript errors were reported.
- `pnpm exec biome check --write src/server/sales src/components/sales
  "src/app/(app)/[org]/sales/invoices"`: PASS.

No local PostgreSQL workflow smoke or browser smoke was run. The integration
wave should exercise goods and services drafts, project client/payment-term
defaults, permission isolation, rejection/cancellation/resubmission, average-cost
stock approval including duplicate-variant lines and concurrent consumption,
insufficient/backdated stock rollback, incoming receipt allocations and printing.
No shared-file change is required for runtime wiring. The existing package.json
test script enumerates tests explicitly, so integration should append
`src/server/sales/calculations.test.ts` to that shared script.
