# Phase 3b payments implementation

Agent C, wave 2, on `build/foundation`. Only settlement-owned paths changed. No push,
schema change, migration, generation, repository-wide formatting or build.

## Files and routes

- `src/server/payments/allocation.ts`: decimal validation, settlement status, overdue
  aging, deterministic chronological running balance, and `REQUIRE_REQUEST_FOR_MODES`.
- `src/server/payments/validation.ts`, `service.ts`, `submission.ts`, `actions.ts`,
  `queries.ts`, `approval.ts`: Zod boundaries, organization/project authorization,
  transactional settlement, approval callbacks, balance and statement queries.
- `src/server/payments/allocation.test.ts`, `service.test.ts`: pure rules and an
  opt-in PostgreSQL test that rolls back every fixture and mutation.
- `src/components/finance/forms.tsx`, `pages.tsx`: request drafts, recording, later
  allocation, voiding, lists, approval history, balances and statements.
- Replaced finance placeholders at `/[org]/finance/payment-requests`, `/new`, `/[id]`,
  `/[org]/finance/payments`, `/new`, `/[id]`, `/[org]/finance/balances`, and
  `/[org]/sales/receipts`. Added `/[org]/finance/balances/[partyId]`.
- Every route reads asynchronous params, session and database data inside Suspense.
  Existing loading segments are retained.

## Settlement rules

Requests have a vendor, optional project, date, purpose, mode, amount and reason.
Drafts can be edited. BILL_SETTLEMENT requires distinct approved/open bills from the
same vendor, organization and currency, with requested amounts summing exactly to
the request amount. Project requests only select that project's bills. Other purposes
have no bill selections. Submission supplies the amount to the existing approval engine.
Final approval rechecks bill outstanding and moves to APPROVED; rejection and cancellation
return to DRAFT. The exported handler signatures are preserved and callbacks audit decisions.

`REQUIRE_REQUEST_FOR_MODES = ["CASH"]` controls outgoing vendor payments. Incoming
cash receipts and direct BANK/UPI/CHEQUE/OTHER payments are permitted with `payment.record`.
Request-backed payments must match request party, mode, currency and project and be
OUTGOING. Partial payments are allowed; total posted payments cannot exceed the request.
The request becomes PAID only when fully fulfilled. BILL_SETTLEMENT payments automatically
allocate the remaining requested bill amounts in stable order, rechecking current outstanding.
If another payment has consumed the outstanding balance, recording fails atomically.

Both directions support later allocation of advances. One payment can cover multiple
documents and multiple payments can cover one document. Allocation validates payment
availability and document outstanding, party, currency, organization, approved status and
project access. Project payments stay within that project. Organization payments may
allocate across accessible projects in the organization currency.

Every mutation obtains the same organization settlement advisory transaction lock.
Document totals are recomputed from allocations of POSTED payments. Vendor bills use
paidTotal; sales invoices use receivedTotal. The same transaction derives APPROVED,
PARTIALLY_PAID or PAID and updates payment allocated/unallocated totals. Decimal arithmetic
uses precision 48, and input money allows at most two decimal places and sixteen integer digits.
Zero payable documents derive PAID when recomputed. No costs or stock entries are posted here.

Voiding requires a reason and `payment.record`, reverses active allocations and recomputes
document settlement in the same transaction. Historical allocations remain attached to the
VOID payment and are excluded from active aggregates. VOID payments have allocatedAmount
zero and unallocatedAmount equal to amount to preserve the schema's split invariant, but
are excluded from balances and advances. Linked fulfilled requests return to APPROVED and
can be paid again. Payment/allocation creation, request changes and voids are audited.

## Balances and statement conventions

Balances show each party once per currency, including parties that are both vendors and
customers. Vendor/customer and project filters are available. Figures include approved
payable totals, allocated settlements, outstanding, unallocated outgoing/incoming advances,
and net position. Positive net is due from the party; negative net is due to the party.
Net = receivable - payable + vendor advance - customer advance. No currency conversion.

Payable and receivable aging are separate, with current, 0–30, 31–60, 61–90 and 90+ buckets
using UTC calendar days past due. Current includes future due dates and missing due dates.
Statements include invoices, bills, cash movements, allocations and void reversals.
Allocation rows change no organization-level net balance, avoiding double counting cash.
For a project statement, an organization payment's allocation to that project is the
attributable cash movement at allocation time. Unallocated organization advances stay out
of project balances. The database test reconciles final organization/project statement
balances with their balance summaries, including voids and organization advances.

Finance access uses `payment.view`, mutations use `payment.record` or
`payment.request.create`, and receipts use `sales.view`. Project custom roles are supported;
organization-level records require organization-level permission. Sales viewers can open
incoming payment details from receipts; outgoing payment details remain restricted.

## Verification

- `node --import tsx --test src/server/payments/allocation.test.ts`: 4/4 passed.
- Local PostgreSQL: `PAYMENTS_DB_TEST=local-only`, shell DATABASE_URL pointed at
  `management-phase3b-shared`, then `node --import tsx --test src/server/payments/*.test.ts`:
  5/5 passed with every fixture rolled back. Covered permission rejection, cash request
  enforcement, submission amount, approve/reject/cancel callbacks, partial request payment,
  request and document overspend, party/currency mismatch, duplicate targets, one payment
  across bills, multiple payments per bill, later advance allocation, incoming receipts,
  retained void history, void/re-pay, audit and statement reconciliation.
- `pnpm test`: all 17 existing tests passed. This script currently lists its files explicitly.
- `pnpm exec tsc --noEmit`: passed across the checkout after fixing owned errors. Earlier
  transient bill-query errors disappeared as the parallel agent completed its changes.
- `pnpm exec biome check --write` limited to payment, finance component/route and receipt
  paths: passed without warnings.
- Full build and browser smoke are reserved for the integration wave, as instructed.

The optional database test uses Node's synchronous module hooks to select server-only's
empty import sentinel in its isolated Node process. It requires Node 22.15+ and was run
with Node 24.18. The installed Node type declarations target v20, so the hook has a local
type declaration. A Better Auth base URL warning appears in the standalone smoke runner;
the test does not exercise login or callbacks. `.env` was not modified.

## Integration handoff

No shared-file change is required for runtime wiring. The approval registry already imports
the preserved payment handler exports and navigation already points to these routes.
Add the two payment test files to the shared `package.json` test command, or switch it to
test discovery during integration. Keep the database test opt-in. Settlement remains the
single writer of paidTotal, receivedTotal, settlement statuses and payment allocation totals.
Do not calculate them separately in bill or sales services.

Organization serialization favors correctness over throughput. Concurrent PostgreSQL
posting and authenticated browser flows remain integration checks. Lists currently load
the accessible finance dataset without pagination; paginate when transaction volume requires it.
