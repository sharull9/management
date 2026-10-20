# Improvement verification, 2026-10-20

The 25 fixes in [the implementation tracker](../plans/README.md) cover authorization, financial correctness, concurrent writes, query performance, error handling and verification tooling. They extend the existing uncommitted Phase IV/V and purchase-order work. The four optional product directions remain outside this repair scope.

## Changes

- Manager assignment requires separate authorization. Ordinary project-team responses omit compensation, member edits protect existing custom roles, and offboarding checks pending approvals.
- Sign-in uses Better Auth's rate-limited HTTP endpoint. Unused organization plugin endpoints are disabled. Task-photo validation matches the Server Action transport limit.
- Settlement reconciles stored document-base amounts across partial payments. Receipt accounting reserves explicit links before generic allocations and distributes accrual minor units exactly. Zero-value base posting legs no longer block valid payments.
- Accounting and source mutations follow a common lock order, reread source state under locks, and serialize shared tenant chart initialization. Regression tests use independent database transactions for payment voids, asset allocation/logging, PO closure/receipt creation, bill approval/history and attendance updates.
- List and picker queries apply scope, search and pagination in the database. Complete financial totals remain independent of displayed pages. Accounting reports use report-specific queries in a repeatable-read snapshot, and ledger pages retain correct opening and running balances.
- Approval inbox queries batch manager resolution. History synchronization uses bounded transactions and a resumable cursor. Journal screens display the actual approver. Unexpected action failures return a generic message and a diagnostic reference.
- CI provisions PostgreSQL, migrates and seeds it, and runs static, unit, database and build checks. Setup commands now match the checkout. Dependency updates and remaining advisory exposure are recorded in [the dependency review](DEPENDENCY_REVIEW.md).

## Verification

The completed implementation run passed:

- All 272 tests, with zero failures and zero skips, using the disposable loopback PostgreSQL database and all opt-in suites.
- TypeScript, module boundaries across 802 files, Prisma schema validation and `git diff --check`.
- Biome across 794 files, with five non-null assertion warnings in accounting chart/posting services and no errors.
- The production build against an unreachable placeholder database, including Workflow compilation and all 98 generated pages.

Browser verification in that run exercised HTTP login and session cookies, production login throttling with an HTTP 429 response, pagination with search resetting to page one, and accounting history synchronization. It did not cover every screen or device. The PostgreSQL driver also emitted a deprecation warning about concurrent queries on one client; compatibility with a future pg 9 upgrade remains unverified.

No production database migrations, deployments, commits or pushes were performed. Environment files were not changed. The local build/test logs are under `.git/improvements-*` and are not committed artifacts.

## Completion after resuming

The final finance review removed the unused payment-request query from balances/statements and deleted the obsolete form serializer. These screens still read complete scoped payment, bill and invoice history. The payment read-loader database regression, production build, TypeScript, lint, boundaries and whitespace checks passed again. Removing the obsolete request payload type afterward also passed TypeScript and static checks.

The disposable `management-improvements-20261020` PostgreSQL container and its anonymous data volume were removed after verification.
