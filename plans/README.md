# Improvement implementation tracker

Approved on 2026-10-20 against HEAD 5d6bd7f and the existing dirty working tree. Implement the 25 audited fixes. Four optional product directions are outside this repair scope. Preserve all pre-existing work. No commits, pushes, deployment, production migrations or edits to .env.

Use GPT-6 Luna with reasoningEffort=high, at most three active workers. Workers share the checkout with disjoint file ownership because the audited assets/accounting work is uncommitted and absent from isolated HEAD worktrees. Root coordinates shared edits and maintains this index.

Verification: pnpm typecheck; pnpm lint; pnpm check:boundaries; pnpm test; pnpm prisma validate; pnpm build with a placeholder DATABASE_URL. Database tests must use a freshly created loopback database; never the configured remote DB. Relevant Next.js installed guides must be read before route code.

| ID | Improvement | Status |
| --- | --- | --- |
| 1 | Restrict who can assign project and stage managers | Complete |
| 2 | Keep compensation out of ordinary project-member responses | Complete |
| 3 | Protect existing custom roles when editing members | Complete |
| 4 | Throttle the application's HTTP sign-in entrypoint | Complete |
| 5 | Apply tenant suspension to remaining auth organization endpoints | Complete |
| 6 | Re-read source state under compatible locks before posting | Complete |
| 7 | Reconcile document-side rounding when settlement completes | Complete |
| 8 | Reserve explicitly linked receipts before generic bill allocation | Complete |
| 9 | Allocate receipt accrual minor units exactly across partial bills | Complete |
| 10 | Handle valid payments whose base-currency effect rounds to zero | Complete |
| 11 | Use one lock order across accounting and source transactions | Complete |
| 12 | Serialize shared tenant account-template initialization | Complete |
| 13 | Align task-photo limits with the actual upload transport | Complete |
| 14 | Protect pending approvals during member offboarding | Complete |
| 15 | Display the actual journal approver | Complete |
| 16 | Add independent-transaction financial and lifecycle tests | Complete |
| 17 | Make verification reproducible in CI | Complete |
| 18 | Repair smoke/demo commands and migration instructions | Complete |
| 19 | Load and paginate only the records each screen needs | Complete |
| 20 | Use report-specific accounting queries and aggregates | Complete |
| 21 | Apply picker search and limits in the database | Complete |
| 22 | Batch approval-inbox manager resolution | Complete |
| 23 | Make accounting history synchronization bounded and resumable | Complete |
| 24 | Separate public action errors from unexpected internal failures | Complete |
| 25 | Triage and update Workflow's flagged serialization dependencies | Complete |

Sequence: security and arithmetic regressions; financial lock/source fixes and two-connection tests; scaling; tooling and integration checks. Source reversals remain immutable; money uses Decimal; tenant/project authorization stays server-side; reports do not create accounting state.

Verification completed on 2026-10-20: all 272 tests passed with no skips, including every opt-in database suite. TypeScript, lint, module boundaries, Prisma validation and the placeholder-database production build passed. Lint retains five accounting non-null assertion warnings. See [the verification report](../docs/IMPROVEMENTS_REPORT.md) for details and limits.
