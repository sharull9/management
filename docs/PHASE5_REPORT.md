# Phase V accounting

Implemented on 18 October 2026 with GPT-6 Luna tasks using `codex_codex_personal`, with no more than four delegated tasks active at once. Existing uncommitted Phase IV work was preserved.

## Implemented behavior

- Tenant account templates and per-organization charts, with 32 protected default system accounts and additive template application.
- Balanced base-currency journals, database-enforced posted immutability, organization-scoped account and journal foreign keys, and deferred balance checks.
- Automatic posting for accepted receipts, stock consumption and sales, transfers, vendor bills, sales invoices, payments, allocations, realized FX and bounded settlement rounding.
- Attendance payroll accrual, approved expense accrual and asset cost clearing. Dedicated inventory postings do not also post operational material CostEntry rows.
- Source retries are idempotent. Edits reverse and replace entries; deletions and payment voids retain exact reversing history. Tax reversals also negate their base snapshots.
- Manual draft journals, normal JOURNAL approvals, rejection/cancellation back to draft and authorized posted manual reversals. Automatic journals are corrected through their source operation.
- General ledger with opening and running balances, trial balance, P&L, balance sheet with cumulative retained profit, and tax/withholding summaries.
- Explicit authorized history synchronization. Reading a report never creates charts or posts historical documents.
- Accounting navigation, permission-gated controls, thin Suspense route adapters and tables that scroll within narrow screens.

Routes are under `/<org>/accounting`: `accounts`, `journals`, `journals/<id>`, `ledger`, `trial-balance`, `profit-loss`, `balance-sheet` and `tax`.

## Verification

All 13 migrations applied successfully to a fresh named local Prisma database. The configured remote database and `.env` were not changed. Earlier local execution caught and corrected a SQL encoding marker and a deferred trigger record-field error before the fresh migration check.

Database checks exercise immutable entries and lines, deferred balance rejection, organization ownership, manual permissions and approvals, exact money/tax reversals, source retries, receipt allocation across partial bills, rejected quantities, FX, rounding, voids, cost allowlisting and history retries. The opt-in suites require `ACCOUNTING_DB_TEST=local-only` and reject non-loopback database URLs. Fixtures run inside transactions that roll back.

Prisma validation, TypeScript, module boundaries, unit tests and the production build passed during integration. The production build used a placeholder database URL and produced all eight accounting routes. Lint had no errors; non-null assertion warnings remained in some accounting tests and checked engine lookups.

Final continuation repaired an interrupted ledger-test extraction by restoring the posting-service import and the approval callback scenario helper. The ledger database test passed after the repair. The full unit run passed 231 tests with seven opt-in database tests skipped. TypeScript, Prisma validation, module boundaries and the production build passed again; lint reported seven warnings and no errors.

All four accounting database scenarios passed in the final continuation. Running the source files concurrently first exhausted the local PGlite transaction-start wait for the stock/bill scenario; running that file alone passed. Run these database files serially on this local setup. The PostgreSQL driver also reports a concurrent-query deprecation warning during source tests.

Collaborative preview verified:

- Journal submission, approval through the existing inbox, and creation of an exact posted reversal through its confirmation sheet.
- A posted INR 5,000 opening entry produced equal INR 5,000 trial-balance totals and INR 5,000 assets/equity. Preview exposed a credit-column calculation error, which was fixed and covered by a regression test.
- Read-only accounts had no create, configuration, history-sync or reversal controls. A journal-only user saw only their own manual register and successfully created a balanced INR 25 draft. Direct report access was rejected.
- Account history synchronization succeeded through the explicit UI control.
- At 390 CSS pixels, report and journal layouts kept document width at 390 pixels while wide tables scrolled inside their containers.

Independent review identified out-of-order bill approvals leaving related receipt allocations stale and inconsistent journal-manager submission permissions. Both were corrected. Final independent review found no confirmed remaining accounting money, scope, immutability or concurrency defect.

## Boundaries

Money columns support at most two decimal places, including currencies with zero minor digits. There are no closed accounting periods. Source corrections are retrospective; payment voids preserve their effective reversal date. There is no payroll settlement module, only attendance payroll accrual. Asset operating costs use a clearing account because their logs do not record payment settlement. Bill price and FX differences go to purchase variance without revaluing historical inventory.

Tax screens summarize frozen accounting snapshots; they do not generate jurisdiction-specific filing forms. Historical source posting requires the explicit synchronization action. No commit, push, production migration or deployment was performed. Further phase work requires user approval.
