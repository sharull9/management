# Code architecture

## Structure and rules

The module refactor is complete on `build/foundation`. This app uses server actions instead of an external API layer. There are no compatibility shims or files under `src/server`.

```text
src/app/                         route entries
src/core/                        shared infrastructure
src/modules/<module>/
  server/                        actions.ts, queries.ts, service.ts, approval.ts, pure helpers, adjacent tests
  schema.ts                      Zod schemas
  type.ts                        types
  constants.ts / util.ts         constants and pure helpers
  ui/components/                 feature components
  ui/views/*-view.tsx             page content
  ui/layouts/*-layout.tsx         layout content
src/components/shared/           shell, tables, pickers, forms, badges, loading, timeline bridge
src/components/ui/               generated shadcn primitives; never edit
src/lib/utils.ts                 shadcn's cn helper
```

`src/app` resolves params/searchParams, performs route-level authorization when needed, and renders module views inside Suspense. Put request-time resolution inside the boundary, preserving the installed Next.js Cache Components behavior. Layouts, loading/error boundaries, redirects, and HTTP handlers remain thin adapters. HTTP business logic belongs in module server files. Read relevant guides in `node_modules/next/dist/docs/` before Next.js edits.

Cross-module imports target the concrete file that defines each symbol, such as `@/modules/payment/server/actions` or `@/modules/tax/util`. Module root imports and all `index.ts`/`index.tsx` files under modules or shared components are forbidden. Shared dependencies use `@/core/*` and `@/components/shared/*`. Generated Prisma types and shadcn primitives retain their existing import paths. Only app adapters may import module `ui/views/*` and `ui/layouts/*`; other module files may be imported across modules except `*.test.ts`. Shared UI stays in `src/components/shared`.

Import functions, types, constants, pure helpers, and server actions directly from their defining files. The stateless Server Component ApprovalTimeline is defined in `approvals/ui/components/approval-timeline.tsx` and used by its shared bridge. Its four presentations preserve existing markup and dates. Client code must not import files that load server-only services. The pure modules below contain no database imports, registrations, or server-only sentinels. Node unit tests use concrete pure files or adjacent files in their own module.

Approval handlers are registered in `src/modules/approvals/server/register.ts`, importing concrete feature approval.ts files. Preserve one registration per document type and existing eager registration. Feature calls into the approval engine load concrete approvals server files with dynamic imports at invocation time to avoid registry import cycles. Procurement receives the registration function as an argument; it does not import the engine at initialization. Keep eager registration covered by `server/register.test.ts`.

The four refactor ownership groups are retained as the module maintenance map:

- G1 owns `admin`, `organization`, `organization-auth`, `masters`, `item-variant`, `uom`, `tax`.
- G2 owns `project`, `project-stage`, `project-task`, `project-team`, `attendance`, `project-cost`, `project-cost-policy`, `workforce`, `assets`, `dashboard`.
- G3 owns `procurement`, `vendor-bill`, `stock-valuation`.
- G4 owns `payment`, `sales-invoice`, `accounting`.

Phase 3c adds `currency`, owned by the integration owner; the contract is [PHASE3C_SHARED.md](PHASE3C_SHARED.md) and the outcome [PHASE3C_REPORT.md](PHASE3C_REPORT.md). Rate prefill (`previewExchangeRate`), the tenant-enabled check (`assertEnabledCurrency`) and the currency/rate form fields live in the currency module; feature modules import them from there.

The integration owner maintains `approvals`, `notifications`, `src/core`, shared components, navigation, package scripts and docs. Route adapters follow their feature's ownership; the project Materials adapter belongs to G2 and renders G3's inventory view. During parallel work, each group edits its modules and route adapters. Coordinate shared edits and consumer import changes with their owner. Completed R2 moves and temporary shim handoffs no longer apply.

One responsibility per file. Split files over approximately 400 lines. Put schemas in schema.ts, types in type.ts, queries in server/queries.ts, mutations in service files, and exported actions in files headed by `"use server"`. Split large views into components or named views. Tests live beside their code as `*.test.ts`.

Business validation that may be shown to users throws `UserFacingError` from `src/core/errors.ts`. `runAction` returns those messages and Zod field errors; unexpected failures return a generic message with a reference and log only redacted diagnostics. Do not wrap an unknown exception's message in a public error.

Paged lists use `src/core/pagination.ts`, database scope/search/count/limit queries, and shared `DataTable.serverPage` or `ServerPagination`. URL keys are `page`, `search`, `sort`, and `sortDirection`; `direction` remains available for domain filters such as incoming/outgoing payments. Changing filters or sorting resets the page. Balance totals and stock valuation aggregate complete authorized history independently of displayed pages. Accounting report queries share a repeatable-read snapshot; ledger queries compute opening and preceding-page balances in the database.

Financial mutations acquire the organization accounting advisory lock before domain or source locks; shared chart initialization then acquires the tenant chart lock. Independent transactions must follow this order. Source adapters reread authoritative state under the lock before calculating replacements. Accounting history uses bounded transactions through `syncHistoryBatchAction`; the UI advances its organization-bound cursor and retains the last completed cursor for retry. Payment-dependent journals remain atomic with their payment.

`pnpm test` uses `node --import tsx --test "src/**/*.test.ts"`. Node 24 expands the quoted glob and discovers every adjacent test file, including the registry regression test. The existing Postgres settlement test remains opt-in with `PAYMENTS_DB_TEST=local-only`. Build with a placeholder DATABASE_URL requires no live database.

## Module map

Cross-module consumers use the concrete entry files below. Paths omit only the `.ts`/`.tsx` extension. Form features also expose concrete `schema` and `server/picker-actions` files where present; import their defining files directly. Modules without cross-module entry files are reached through their route views. Inventory belongs to procurement because its documents share purchasing forms and submission flows.

| Module | Responsibility | Main entry files |
| --- | --- | --- |
| `admin` | Tenant administration and suspension | `server/actions`, `schema` |
| `accounting` | Chart templates, organization accounts, immutable journals, source posting, approval and financial reports | `schema`, `util`, `server/chart-service`, `server/posting-service`, `server/journal-service`, `server/source-procurement`, `server/source-sales`, `server/source-stock`, `server/source-payments`, `server/source-costs`, `server/queries`, `server/reports`, `server/history-service`, `server/history-actions`, `server/actions` |
| `approvals` | Policies, engine, inbox, links, manager authorization and timelines | `schema`, `server/actions`, `server/picker-actions`, `workflows/approval-reminder`, `server/start-reminder`, `server/authorization`, `server/document-link`, `server/handlers`, `server/policy`, `server/project-effects`, `server/register`, `server/service`, `ui/components/approval-timeline` |
| `attendance` | Attendance and labour costing | `server/actions`, `server/costing`, `schema` |
| `assets` | Vehicles, machinery, allocations, trip/usage/fuel logs and project costs | `schema`, `util`, `server/actions`, `server/log-actions`, `server/queries`, `server/registry-service`, `server/log-service`, `server/authorization`, `server/fuel-efficiency` |
| `currency` | Currency master, tenant currencies, base currency, exchange rates, rate resolution and cost-entry amounts | `util`, `schema`, `rate-format`, `server/rates`, `server/enabled`, `server/fx-actions`, `server/cost-entry`, `server/base-currency`, `server/queries`, `server/actions`, `server/picker-actions`, `ui/components/currency-fx-fields` |
| `dashboard` | Organization dashboard | None |
| `item-variant` | Pure variant identity and level configuration | `util` |
| `masters` | Tenant locations, items, UOMs, parties and taxes | `server/location-actions`, `server/queries`, `server/service`, `schema`, `server/actions`, `server/picker-actions` |
| `notifications` | Scoped in-app notifications, latest items and mark-read actions | `server/queries`, `server/actions`, `schema` |
| `organization` | Organizations, members, roles, numbering and user provisioning | `server/actions`, `server/member-actions`, `server/numbering-actions`, `server/provision-user`, `server/role-actions`, `schema`, `server/picker-actions` |
| `organization-auth` | Setup, sign-in and sign-out actions | `server/actions`, `schema` |
| `payment` | Requests, payments, allocations, voids, balances, aging and statements | `constants`, `schema`, `server/allocation-service`, `server/approval`, `server/balances`, `server/payment-service`, `server/queries`, `server/request-service`, `server/statement`, `server/submission`, `server/void-service`, `server/actions`, `server/picker-actions` |
| `procurement` | PR, PO, GRN, project inventory, consumption and transfers | `constants`, `schema`, `server/approval`, `server/inventory/service`, `server/order-service`, `server/queries`, `server/receipt-service`, `server/request-service`, `server/service`, `server/submission`, `server/actions`, `server/picker-actions` |
| `project` | Projects, sites, budgets, manager resolution and approval auditing | `server/action-helpers`, `server/actions`, `server/approval`, `server/approval-audit`, `server/budget-actions`, `server/queries`, `server/site-actions`, `schema`, `server/picker-actions` |
| `project-cost` | Expense approval, project costs and recognition settings | `server/actions`, `server/approval`, `server/budget-usage`, `server/cost-recognition`, `server/queries`, `schema`, `server/picker-actions` |
| `project-cost-policy` | Pure recognition effects and change guard | `util` |
| `project-stage` | Stage management | `server/actions`, `schema` |
| `project-task` | Tasks, work, submissions, delays and document lookup | `server/actions`, `server/approval`, `server/queries`, `server/work-actions`, `schema`, `server/picker-actions` |
| `project-team` | Project membership | `server/actions`, `schema`, `server/picker-actions` |
| `sales-invoice` | Customer invoices, approval, printing and stock sales | `constants`, `schema`, `server/approval`, `server/service`, `server/actions`, `server/picker-actions` |
| `stock-valuation` | Pure moving-average inventory valuation | `util` |
| `tax` | Pure tax scope and calculation | `util` |
| `uom` | Pure unit conversion | `util` |
| `vendor-bill` | Vendor bills, receipt reservations, variance costing and attachments | `constants`, `schema`, `server/approval`, `server/attachment`, `server/service`, `server/actions`, `server/picker-actions` |
| `workforce` | Workers, designations and availability | `server/actions`, `server/availability`, `schema`, `server/picker-actions` |

## Workflows

Workflow DevKit orchestrators and steps live in `src/modules/<module>/workflows/`.
Orchestrators use `"use workflow"`; database and other I/O live in `"use step"`
functions. Start runs after commit, never inside database transactions. Steps must
be idempotent under retries. Do not post money or cost ledger entries inside workflows.

Approval reminders capture the initial pending step and delay at submission. The
delay defaults to 24 hours; a positive `APPROVAL_REMINDER_HOURS` overrides it,
including fractional hours for local verification. Each wake locks and re-reads
the request, checks that the same step is pending, resolves eligible users through
the engine authorization rules, and inserts notifications with deterministic IDs.
Runs stop after three reminders or when the captured step is no longer pending.
They do not advance approvals or change approvers.

When submission owns the transaction it awaits commit before starting. For
caller-owned transactions in Server Functions, `next/server`'s `after` registers
a callback that runs after the response. The callback reads with the root client;
a rolled-back request is absent and is skipped. Scheduling/start failures are
logged and never fail submission. Non-HTTP callers with a caller-owned transaction
must call `startApprovalReminder(request.id, request.steps[0].id)` after their transaction resolves,
because `after` requires a Next request context. This best-effort launch has a
crash window between commit and start; guaranteed delivery would require an outbox.

`withWorkflow` generates `/.well-known/workflow/v1/flow` and
`/.well-known/workflow/v1/webhook/:token`; generated files are SDK-ignored. The
proxy excludes the workflow prefix. Keep `WORKFLOW_PUBLIC_MANIFEST` unset in
production; enabling it publishes `/.well-known/workflow/v1/manifest.json`.
Development uses the bundled local world and ignored `.workflow-data/` directory.

Self-hosted production uses `@workflow/world-postgres`. Set `WORKFLOW_TARGET_WORLD`
and `WORKFLOW_POSTGRES_URL` as shown in `.env.example`, and run `pnpm exec bootstrap`
with that URL to apply the world's own idempotent migrations. Run a long-lived
worker, not a serverless process. `src/instrumentation.ts` exports Next's async
`register()` hook. Only `NEXT_RUNTIME=nodejs` with
`WORKFLOW_TARGET_WORLD=@workflow/world-postgres` dynamically imports
`workflow/runtime`, awaits `getWorld()` and awaits `world.start?.()`. Local and
Edge runtimes skip it. Startup errors propagate so a broken worker configuration
fails server initialization. No extra shutdown handler is installed; leave
`WORKFLOW_POSTGRES_APPLICATION_MANAGED_SHUTDOWN` unset so Graphile Worker owns
its normal signal handling.

Verified against installed `@workflow/world-postgres@5.0.3` `dist/index.js` and
`dist/queue.js`: start initializes the queue and re-enqueues active runs; queue
startup is memoized and defers its runner until the loopback executor is reachable.
This supports Next's register-before-ready ordering. `WORKFLOW_LOCAL_BASE_URL`
points workers at the app, usually loopback. Bootstrap the world before startup;
the hook does not replace its schema migrations. The adjacent instrumentation
test uses the SDK's `setWorld` to check runtime/world gating and startup failures.
The reference Postgres world ships without HTTP authentication: block external
access to the flow route at ingress while allowing worker delivery. Do not put it
back behind the session proxy. See the installed world's README and
[Postgres world docs](https://workflow-sdk.dev/worlds/postgres).

## Shared infrastructure and integration checks

Phase V accounting follows [PHASE5_SHARED.md](PHASE5_SHARED.md) and [PHASE5_API.md](PHASE5_API.md). Source modules call concrete accounting adapters inside their existing transactions. Accounting imports source rows through Prisma rather than importing source services. Only posted journals enter financial reports. Corrections reverse and replace entries; operational CostEntry rows remain a separate ledger. History synchronization is an explicit authorized action, never a page-read side effect. Opt-in accounting checks require `ACCOUNTING_DB_TEST=local-only` and a loopback database URL.

All money writes follow the [Phase 3c currency contract](PHASE3C_SHARED.md): every CostEntry write goes through `currency/server/cost-entry`.

`src/core` owns the Prisma client, tenancy and permissions, auth, storage, numbering, audit, decimal arithmetic, form-data and common schema helpers. The pure `item-variant`, `uom`, `tax`, `stock-valuation` and `project-cost-policy` util.ts files contain no database imports or server registrations. Browser code uses these pure files for cross-module calculations.

`pnpm check:boundaries` scans imports, re-exports, dynamic imports, import types and require calls in `src` and `scripts`, excluding generated code. It resolves both aliases and relative paths. A module may import its own internals. Only `src/app` may import another module's `ui/views/*` or `ui/layouts/*`; HTTP handlers use concrete module server files. Module root imports, cross-module test imports, and any `index.ts`/`index.tsx` file under `src/modules/**` or `src/components/shared/**` are errors. The script includes assertions for permitted and forbidden paths.

Approval path constants retain existing URLs. Task links resolve submission/delay IDs within the request organization and project. Missing task lookups retain the costs fallback; requests without a project retain the approvals fallback. The project `server/approval-audit.ts` file defines the shared approval audit helper, used by task and expense handlers. Their pure effect tests remain adjacent to the approvals helpers.

Migration `20261010203000_signed_material_cost` permits negative amounts only for MATERIAL costs whose source is TRANSFER or BILL_VARIANCE. All other amounts remain nonnegative. Migration `20261013100000_phase3c_currency` extends that check to `originalAmount` and `baseAmount`, so all three amounts share a sign. Old migrations are unchanged. Local migration and settlement/workflow verification are recorded in [PHASE3B_REPORT.md](PHASE3B_REPORT.md).

`pnpm verify` runs TypeScript, lint, module boundaries and database-free tests. `pnpm test:db` enables the opt-in suites and runs files serially; it requires a loopback PostgreSQL URL and a disposable database name ending in `_test`. The committed CI workflow deploys fresh migrations and seeds its PostgreSQL service before running these checks. The old `smoke:phase3b` harness is not present in this checkout; phase reports retain its historical results. Use a placeholder DATABASE_URL for production builds. Do not push or commit `.env`, `src/generated`, or `storage/`.
