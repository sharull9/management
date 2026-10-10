# Phase 3b vendor bills

Implemented by agent B on `build/foundation`. No schema, migrations, shared approval registry,
permissions, payment posting, or environment files changed. No push.

## Routes

- `/[org]/procurement/bills`: project, vendor (`partyId`), status and overdue filters;
  code, vendor invoice number, vendor, project, bill date, due date, grand total, paid,
  outstanding payable balance and status columns.
- `/[org]/procurement/bills/new`: direct bill or approved PO selection.
  `?po=<id>` prefills the selected order. Draft editing is on the bill detail page.
- `/[org]/procurement/bills/[billId]`: PO versus billed rates, signed variance, tax and
  withholding snapshots, totals, attachments, approval history, allocated payments,
  linked PO and GRNs, draft editor and submission.
- `/[org]/procurement/bills/[billId]/attachments/[attachmentId]`: private invoice-copy
  download through existing storage, authenticated with project-scoped `bill.view`.
- PO detail has a permission-aware Create bill link for approved/received/closed orders.

All page runtime reads are inside explicit Suspense boundaries. Dynamic params and search
params use the installed Next.js Promise conventions.

## Rules

Creation, draft edits, submission and attachment upload require project-scoped `bill.create`.
Detail/download require `bill.view`; list rows are limited to projects accessible with that
permission. Projects, vendor parties, optional variants, units and tax groups are validated
against organization/tenant boundaries. Currency comes from the project. A linked PO must
have the same organization, project, vendor and currency and be APPROVED, PARTIALLY_RECEIVED,
RECEIVED or CLOSED. Every linked bill line must match its PO variant and unit.

Direct bills support description-only service lines with a unit, quantity, rate, discount
and tax group, or an existing item variant. Direct lines cannot carry PO/GRN references.
Vendor invoice number/date and bill date are required. Blank due date defaults to bill date
plus the vendor's paymentTerms days. The UI displays that default and permits an override.
Draft edits keep the project identity, consistent with existing procurement draft services.

Received quantity is the PO's physical receivedQty, including rejected quantities, as requested.
All non-cancelled bills reserve quantities, including drafts, pending, approved and settled bills.
Prefill splits the remaining quantity across approved GRN lines in creation order and records
both poLineId and grnLineId. Unlinked historical reservations reduce the aggregate PO balance.
Edits exclude their own prior quantities. Both PO-line and explicit GRN-line aggregate limits
are checked on save, submit and final approval. Repeated line IDs are aggregated before checking.
PO advisory locks serialize quantity reservations and use the existing GRN approval PO lock.
GRN references must point to an approved receipt for the same PO line and unit.

Vendor invoice numbers are trimmed and blocked case-insensitively for the same organization
and vendor across non-cancelled bills. A vendor/organization advisory lock serializes that check.
Bill advisory locks protect edits, attachments, submission and final decisions. Changes require
DRAFT. There is no independent bill cancellation action; rejection and approval-request cancellation
return the pending bill to DRAFT, following the shared handler contract.

All calculations use the shared high-precision Decimal and procurement calculateTax helpers.
Money snapshots round half-up to two decimal places; quantity/rate inputs permit four decimals.
Subtotal is the sum of gross line amounts; discountTotal reconciles gross and discounted snapshots.
Non-withholding tax contributes to grandTotal; withholding is separately snapshotted and subtracted
only for payableTotal. Line totals exclude withholding. Balance is payableTotal minus paidTotal.
Tax groups validate tenant, organization country and known vendor/organization state scope.

Each PO-linked variance is `(billed rate * (1 - discount / 100) - PO netRate) * quantity`,
rounded to money precision. poRate snapshots the original PO gross rate. Direct lines have zero
variance. Submission passes grandTotal to the existing VENDOR_BILL approval engine. Final approval
sets APPROVED and creates one MATERIAL / BILL_VARIANCE CostEntry for the signed net variance,
sourceId = bill.id. Zero net variance creates no cost row. Negative amounts are retained. Handler
source identity, organization, approval request and PENDING_APPROVAL are checked transactionally.
The existing ledger source uniqueness plus guarded status prevent duplicate posting.

paidTotal is initialized to zero only on creation. No bill code writes settlement totals or
PARTIALLY_PAID/PAID. Detail reads PaymentAllocation and linked Payment records; payment posting and
settlement status are owned by agent C.

Invoice copies use Attachment with entityType VendorBill and the existing storage abstraction.
PDF, PNG and JPEG up to 900 KB are accepted on draft detail, with failed database-write cleanup.
Uploads and cost/document effects write audit records. Numbering uses nextDocumentNumber BILL.

## Files

- `src/server/bills/actions.ts`, `approval.ts`, `service.ts`, `queries.ts`, `validation.ts`,
  `calculations.ts`, `calculations.test.ts`, `validation.test.ts`.
- `src/components/bills/form.tsx`, `pages.tsx`.
- The bills list/new/detail pages and private attachment download route.
- One Create bill link in `src/components/procurement-pages.tsx`.
- This report. Existing bills index exports and loading skeleton remain usable.

## Verification

- `node --import tsx --test src/server/bills/calculations.test.ts src/server/bills/validation.test.ts`:
  PASS, 6/6 tests. Covers quantity reservations, cancellation exclusions, GRN splitting, signed
  net-rate variance, withholding totals, rounding reconciliation, dates and decimal/input bounds.
- `pnpm test`: PASS, 17/17 existing tests.
- `pnpm exec tsc --noEmit`: PASS after bill implementation and GRN prefill changes.
- `pnpm exec biome check --write src/server/bills src/components/bills 'src/app/(app)/[org]/procurement/bills' src/components/procurement-pages.tsx`:
  PASS, 17 files checked.
- No generate, migrations, repo-wide formatting, build, database smoke or browser smoke run.
  Full browser and transaction/concurrency smoke belongs to the integration wave.

## Shared-file handoff

No shared-file changes are required for functionality: the bill download route avoids modifying
`/api/attachments/[attachmentId]`, whose current entity allowlist excludes VendorBill.
For integration, add both bill test files to package.json's explicit test script if they should run
under the normal `pnpm test` command. The owned test files already run with the command above.
