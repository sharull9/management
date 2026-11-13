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

## Live verification

Run on 2026-11-13 on Windows against a disposable PostgreSQL 17 container, Next.js
16.4.3, Prisma 7.10.0, `workflow@5.2.0` and `@workflow/world-postgres@5.0.3`. This
supersedes the earlier "blocked by policy" attempt: the compiled application was
started, approved submissions were made through the real service, and the outbox,
Workflow world and notification tables were read with SQL.

### Setup

All environment values were passed to each process; no `.env` file was created or
edited and no existing database was touched.

```text
docker run -d --name sharull-reminder-live \
  -e POSTGRES_PASSWORD=liveverify -e POSTGRES_USER=verify \
  -e POSTGRES_DB=management_live -p 127.0.0.1:55439:5432 postgres:17
DATABASE_URL="postgresql://verify:liveverify@127.0.0.1:55439/management_live?schema=public"
DATABASE_POOL_MAX=2
APPROVAL_REMINDER_HOURS=0.001   # 3600 ms, frozen into the outbox at submission
WORKFLOW_TARGET_WORLD="@workflow/world-postgres"
WORKFLOW_POSTGRES_URL=<same disposable database>
WORKFLOW_LOCAL_BASE_URL="http://127.0.0.1:3107"
WORKFLOW_POSTGRES_MAX_POOL_SIZE=4
BETTER_AUTH_URL="http://127.0.0.1:3107"
```

`pnpm install` needs `DATABASE_URL` because its postinstall runs `prisma generate`.
Migrations and seed: `node_modules/.bin/prisma migrate deploy` (all 15 migrations,
including `20261031010000_approval_reminder_outbox`) and
`node --import tsx prisma/seed.ts`. World schema:
`WORKFLOW_POSTGRES_URL=... node node_modules/@workflow/world-postgres/bin/setup.js`,
which reported `Database schema created successfully`. Build:
`DATABASE_URL=<unreachable placeholder> node node_modules/next/dist/bin/next build`
reported `Compiled workflows in 2.0s (18 steps, 1 workflow)` and generated
`/.well-known/workflow/v1/flow`. Server: `node node_modules/next/dist/bin/next start -p 3107`
with the environment above; the log showed the Graphile worker starting.

Approval submission was driven by a temporary `tsx` script (deleted afterwards) that
imported the real `submitForApproval` from `src/modules/approvals/server/service.ts`,
used a caller-owned `db.$transaction`, and passed an explicit `OrgContext` for a
fixture tenant, organization, `OWNER` member and a single `USER` approval policy for
`PURCHASE_REQUEST`. A `node:module` resolve hook replaced `server-only` so plain Node
could import the module, as the opt-in database suite already does. Because the
caller owns the transaction, the service registers only the deferred callback:
`after()` throws outside an HTTP request scope and is swallowed, so the launch came
from `dispatchReminderOutbox` in the app process. The HTTP `after()` acceleration
path was therefore **not** exercised; no authenticated browser session was opened.

### a) Submission enqueues, dispatcher delivers — PASS

Submission at 10:38:37.652 UTC returned
`{"delayMs":3600,"status":"PENDING"}` for step `cmweug8r30001w8meqdskaayt`. The
server's recovery pass claimed it 19 s later, and SQL showed the accepted launch:

```text
 stepId                    | delayMs | status    | attempts | runId                          | completedAt
 cmweug8r30001w8meqdskaayt |    3600 | DELIVERED |        1 | wrun_01M7A7TBWQ5GJWMYE1PKJ47EYN | 2026-11-13 10:38:56.617

 id                             | name                                                                             | status    | completed_at
 wrun_01M7A7TBWQ5GJWMYE1PKJ47EYN | workflow//./src/modules/approvals/workflows/approval-reminder//approvalReminder | completed | 10:39:05.253
```

The outbox row was created inside the submission transaction with the frozen 3600 ms
delay, and the dispatcher recorded the Workflow run id returned by the SDK.

### b) Process death with a PENDING row, restart recovery — PASS

Two rows were used so both parts of the recovery path are covered.

1. `cmweupjoj0001vgmeutp7w2ly` was submitted at 10:45:51.721 UTC while the server was
   running, and the whole server process tree (`taskkill /T /F` on the root PID:
   shim, wrapper and Node server) was killed immediately afterwards. The row was
   verified `PENDING` with `attempts = 0` and the port refused connections, so no
   process was left that could dispatch it. The container and database stayed up.
2. `cmweux3lu0001hgmehz8q56yy` was submitted at 10:51:44.135 UTC with the server
   stopped, then set to the state a worker leaves behind when it dies between claim
   and acknowledgement: `leaseToken = 'killed-worker-live-verify-2'`,
   `leaseUntil = now() + 45 s` (10:52:29.314), `attempts = 1`.

A new server process started at 10:46:44 UTC (ready in 3 s) and delivered the first
row in its first pass, 1-2 s later, with no HTTP request:

```text
 stepId                    | status    | attempts | runId                          | completedAt
 cmweupjoj0001vgmeutp7w2ly | DELIVERED |        1 | wrun_01M7A88PB6SWVX18KN7ZHHY0C2 | 10:46:45.890
 cmweux3lu0001hgmehz8q56yy | -         |        - | not created yet                 | -
```

The second row was created afterwards, with the server stopped again, and a third
process started at 10:51:56 UTC (ready after 13 s). Its first recovery pass left the
row untouched because the dead worker's lease was still live:

```text
 10:52:09  PENDING | 1 | killed-worker-live-verify-2 | leaseUntil 10:52:29.314 | no run
 10:52:20  PENDING | 1 | killed-worker-live-verify-2 | leaseUntil 10:52:29.314 | no run
 10:52:35  DELIVERED | 2 | - | - | wrun_01M7A8K9B2PPT1PRS79DRCY91D
```

It was reclaimed only after the lease expired, with `attempts` incremented 1 -> 2,
and then delivered. The restarted processes therefore reclaim committed intents and
expired leases, and do not steal live leases.

A first attempt at step 1 was discarded: only the outer shim PID was killed, its
child kept serving on port 3107, and that child delivered the row. The results above
come from the corrected run that killed the whole tree and verified the port was
closed before restarting.

### c) Reminder notifications created once per run — PASS

Every one of the seven submissions produced a completed run and exactly three
notifications for its request, for example:

```text
 id                                                                                         | title                  | createdAt
 approval-reminder:cmweupjoh...:cmweupjoj...:0:cmweuf7os...                                  | Approval reminder 1 of 3 | 10:46:46.446
 approval-reminder:cmweupjoh...:cmweupjoj...:1:cmweuf7os...                                  | Approval reminder 2 of 3 | 10:46:50.660
 approval-reminder:cmweupjoh...:cmweupjoj...:2:cmweuf7os...                                  | Approval reminder 3 of 3 | 10:46:54.794
```

Reminders arrived about 4 s apart, matching the configured 3600 ms delay, and the
run stopped after the third. The recovered runs kept the original submission
deadline: a row delivered at 10:46:45 for a 10:45:51 submission reminded
immediately rather than waiting another interval.

Duplicate protection was checked live by resetting a delivered row to `PENDING` with
`runId = NULL` and a fresh `availableAt`, which starts a second run for the same
request, step and reminder numbers (the lost-acknowledgement case). The second run
(`wrun_01M7A8BEWRWR57848K240VQA7H`) completed, and the totals did not change:

```text
 total | distinct_ids        ->  21 | 21        (7 requests x 3 reminders)
 select ... group by request, ordinal having count(*) > 1   ->  0 rows
```

### Gates

- `pnpm --config.verify-deps-before-run=false typecheck`: PASS, no diagnostics.
- `pnpm --config.verify-deps-before-run=false test`: PASS, 278 tests, 261 passed,
  0 failed, 17 skipped (opt-in database suites).
- `pnpm --config.verify-deps-before-run=false lint`: FAIL. Biome reports five
  `lint/style/noNonNullAssertion` diagnostics in
  `src/modules/accounting/server/chart-service.ts` (lines 60, 66, 138) and
  `src/modules/accounting/server/posting-service.ts` (lines 193, 194), and exits
  non-zero with "Found 1 error. Found 5 warnings." Neither file is touched by this
  change, so the failure is not caused by it; the warnings match the five existing
  accounting non-null assertion warnings noted above.
- `pnpm <script>` was run with `--config.verify-deps-before-run=false` because the
  default dependency-status pre-check runs `pnpm install`, which exits 1 with
  `ERR_PNPM_IGNORED_BUILDS` for the pre-existing `@swc/core` and `cbor-extract`
  entries and rewrites placeholder `allowBuilds` entries into `pnpm-workspace.yaml`.
  That rewrite was reverted and is not committed.

### Cleanup

The server processes were stopped, the container `sharull-reminder-live` and its
volume were removed, and the temporary scripts, logs, fixture JSON and PID files
under `%TEMP%` were deleted. No `.env`, existing database, generated Prisma client or
storage file was modified, and nothing was pushed.
