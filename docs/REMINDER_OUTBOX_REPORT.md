# Approval reminder outbox

Approval submission now commits a reminder launch intent alongside the approval request and its initial pending step. The outbox stores the configured delay and creation time. A transaction rollback leaves no launch intent. HTTP callbacks accelerate dispatch; a background worker handles committed intents when the callback is lost or a non-HTTP caller owns the transaction.

## Dispatch and recovery

Each pass claims up to ten jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`. A two-minute lease and unique claim token allow recovery after a worker dies and prevent an expired worker from overwriting a replacement's acknowledgement. SDK launches run outside the database transaction and time out after 30 seconds. Failures retry indefinitely with exponential backoff from 30 seconds to one hour.

`PENDING` means the launch is waiting or leased. `DELIVERED` records the accepted Workflow run ID, not a delivered notification. `SKIPPED` records a completed/rejected/cancelled request, an initial step that is no longer pending, or a suspended tenant. Skipped entries do not restart automatically if a tenant is reactivated.

Node startup starts a singleton recovery loop after initializing the configured Postgres Workflow world. Local development also starts recovery for the default local world. The loop polls immediately and then 30 seconds after each pass. Its timer does not prevent process shutdown. A healthy long-lived Node process and reachable database are required. Edge and production local-world deployments do not run this recovery loop.

A crash after Workflow accepts a run but before acknowledgement can launch it again. Notification IDs remain deterministic per request, step, reminder number and recipient, so retries cannot produce duplicate notifications. Recovered runs keep the original first-reminder deadline and then use the configured interval. Existing three-argument workflow runs remain supported. Only the initial approval step receives reminders, preserving existing behavior. Workflow execution and delivery after acceptance remain the SDK's responsibility.

## Deployment

Migration `20261031010000_approval_reminder_outbox` creates the outbox and backfills currently pending initial steps. Historical delay overrides were not persisted; the backfill uses the 24-hour default and the original approval creation time. Existing runs may overlap backfilled launches; notification IDs prevent duplicates. Existing outbox entries are preserved if the backfill statement is retried.

Apply migrations, regenerate Prisma Client and restart the Node server. Keep the Postgres world bootstrapped, its loopback executor reachable, and existing ingress restrictions on Workflow routes. See [the Workflow configuration](ARCHITECTURE.md#workflows).

No production migrations, deployment, commits or pushes were performed. Environment files were not edited; `.env.example` only gains explanatory comments.

## Verification

The new database regression covers atomic enqueue/rollback through the real submission service, frozen delay values, a lost SDK response, backoff, expired leases, competing dispatchers, stale acknowledgements, terminal requests, advanced steps, suspension, deterministic notification deduplication and the exact historical backfill statement.

Unit checks cover the original first-reminder deadline, compatibility with old runs, startup gating, singleton polling, retry after poll failure, stop and restart. The database tests inject only the external Workflow launch; database claims, transactions, approval submission and notification writes run against native PostgreSQL. Live queue delivery and a production process restart are not end-to-end verified by these tests.

All 278 tests passed with zero failures and zero skips, including every opt-in database suite, against a freshly migrated and seeded native PostgreSQL 17 database bound to loopback. TypeScript, lint, module boundaries, Prisma validation and whitespace checks passed. Lint retains five existing accounting non-null assertion warnings. The production build passed with an unreachable placeholder database after retrying Next.js's security stop. Next.js 16.4.0 reports a known security vulnerability and recommends an upgrade.

The installed `@vercel/oidc@3.2.0` junction also pointed at missing package files. The exact archive was restored after checking its SHA-512 against the lockfile; dependency versions and the lockfile did not change.

The real Postgres Workflow and Graphile schemas bootstrapped successfully in a separate disposable runtime database. Automatic approval review then rejected starting the compiled local application for a live recovery/restart check, reporting only `blocked by policy`. No live queue delivery or process restart is claimed. The disposable PostgreSQL container and its data volume were removed after verification.

Verification logs are under `.git/reminder-outbox-*.log`.
