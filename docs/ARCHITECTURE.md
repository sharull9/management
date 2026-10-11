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

Cross-module imports target the concrete file that defines each symbol, such as `@/modules/payment/server/actions` or `@/modules/tax/util`. Module root imports and module barrel files are forbidden. Shared dependencies use `@/core/*` and `@/components/shared/*`. Generated Prisma types and shadcn primitives retain their existing import paths. Only app adapters may import module `ui/views/*` and `ui/layouts/*`; other module files may be imported across modules except `*.test.ts`. Shared UI stays in `src/components/shared`.

Import functions, types, constants, pure helpers, and server actions directly from their defining files. The stateless Server Component ApprovalTimeline is defined in `approvals/ui/components/approval-timeline.tsx` and used by its shared bridge. Its four presentations preserve existing markup and dates. Client code must not import files that load server-only services. The pure modules below contain no database imports, registrations, or server-only sentinels. Node unit tests use concrete pure files or adjacent files in their own module.

Approval handlers are registered in `src/modules/approvals/server/register.ts`, importing concrete feature approval.ts files. Preserve one registration per document type and existing eager registration. Feature calls into the approval engine load concrete approvals server files with dynamic imports at invocation time to avoid registry import cycles. Procurement receives the registration function as an argument; it does not import the engine at initialization. Keep eager registration covered by `server/register.test.ts`.

The four refactor ownership groups are retained as the module maintenance map:

- G1 owns `admin`, `organization`, `organization-auth`, `masters`, `item-variant`, `uom`, `tax`.
- G2 owns `project`, `project-stage`, `project-task`, `project-team`, `attendance`, `project-cost`, `project-cost-policy`, `workforce`, `dashboard`.
- G3 owns `procurement`, `vendor-bill`, `stock-valuation`.
- G4 owns `payment`, `sales-invoice`.

The integration owner maintains `approvals`, `src/core`, shared components, navigation, package scripts and docs. Route adapters follow their feature's ownership; the project Materials adapter belongs to G2 and renders G3's inventory view. During parallel work, each group edits its modules and route adapters. Coordinate shared edits and consumer import changes with their owner. Completed R2 moves and temporary shim handoffs no longer apply.

One responsibility per file. Split files over approximately 400 lines. Put schemas in schema.ts, types in type.ts, queries in server/queries.ts, mutations in service files, and exported actions in files headed by `"use server"`. Split large views into components or named views. Tests live beside their code as `*.test.ts`.

`pnpm test` uses `node --import tsx --test "src/**/*.test.ts"`. Node 24 expands the quoted glob and discovers every adjacent test file, including the registry regression test. The existing Postgres settlement test remains opt-in with `PAYMENTS_DB_TEST=local-only`. Build with a placeholder DATABASE_URL requires no live database.

## Module map

Cross-module consumers use the main entry files below. Modules without cross-module entry files are reached through their route views. Inventory belongs to procurement because its documents share purchasing forms and submission flows.

| Module | Responsibility | Main entry files |
| --- | --- | --- |
| `admin` | Tenant administration and suspension | `server/actions` |
| `approvals` | Policies, engine, inbox, links, manager authorization and timelines | `server/actions`, `server/authorization`, `server/document-link`, `server/handlers`, `server/policy`, `server/project-effects`, `server/register`, `server/service`, `ui/components/approval-timeline` |
| `attendance` | Attendance and labour costing | `server/actions`, `server/costing` |
| `dashboard` | Organization dashboard | None |
| `item-variant` | Pure variant identity and level configuration | `util` |
| `masters` | Tenant locations, items, UOMs, parties and taxes | `server/location-actions`, `server/queries`, `server/service` |
| `organization` | Organizations, members, roles, numbering and user provisioning | `server/actions`, `server/member-actions`, `server/numbering-actions`, `server/provision-user`, `server/role-actions` |
| `organization-auth` | Setup, sign-in and sign-out actions | `server/actions` |
| `payment` | Requests, payments, allocations, voids, balances, aging and statements | `constants`, `schema`, `server/allocation-service`, `server/approval`, `server/balances`, `server/payment-service`, `server/queries`, `server/request-service`, `server/statement`, `server/submission`, `server/void-service` |
| `procurement` | PR, PO, GRN, project inventory, consumption and transfers | `constants`, `schema`, `server/approval`, `server/inventory/service`, `server/order-service`, `server/queries`, `server/receipt-service`, `server/request-service`, `server/service`, `server/submission` |
| `project` | Projects, sites, budgets, manager resolution and approval auditing | `server/action-helpers`, `server/actions`, `server/approval`, `server/approval-audit`, `server/budget-actions`, `server/queries`, `server/site-actions` |
| `project-cost` | Expense approval, project costs and recognition settings | `server/actions`, `server/approval`, `server/budget-usage`, `server/cost-recognition`, `server/queries` |
| `project-cost-policy` | Pure recognition effects and change guard | `util` |
| `project-stage` | Stage management | `server/actions` |
| `project-task` | Tasks, work, submissions, delays and document lookup | `server/actions`, `server/approval`, `server/queries`, `server/work-actions` |
| `project-team` | Project membership | `server/actions` |
| `sales-invoice` | Customer invoices, approval, printing and stock sales | `constants`, `schema`, `server/approval`, `server/service` |
| `stock-valuation` | Pure moving-average inventory valuation | `util` |
| `tax` | Pure tax scope and calculation | `util` |
| `uom` | Pure unit conversion | `util` |
| `vendor-bill` | Vendor bills, receipt reservations, variance costing and attachments | `constants`, `schema`, `server/approval`, `server/attachment`, `server/service` |
| `workforce` | Workers, designations and availability | `server/actions`, `server/availability` |

## Shared infrastructure and integration checks

`src/core` owns the Prisma client, tenancy and permissions, auth, storage, numbering, audit, decimal arithmetic, form-data and common schema helpers. The pure `item-variant`, `uom`, `tax`, `stock-valuation` and `project-cost-policy` util.ts files contain no database imports or server registrations. Browser code uses these pure files for cross-module calculations.

`pnpm check:boundaries` scans imports, re-exports, dynamic imports, import types and require calls in `src` and `scripts`, excluding generated code. It resolves both aliases and relative paths. A module may import its own internals. Only `src/app` may import another module's `ui/views/*` or `ui/layouts/*`; HTTP handlers use concrete module server files. Module root imports and cross-module test imports are errors. The script includes assertions for permitted and forbidden paths.

Approval path constants retain existing URLs. Task links resolve submission/delay IDs within the request organization and project. Missing task lookups retain the costs fallback; requests without a project retain the approvals fallback. The project `server/approval-audit.ts` file defines the shared approval audit helper, used by task and expense handlers. Their pure effect tests remain adjacent to the approvals helpers.

Migration `20261010203000_signed_material_cost` permits negative amounts only for MATERIAL costs whose source is TRANSFER or BILL_VARIANCE. All other amounts remain nonnegative. Old migrations are unchanged. Local migration and settlement/workflow verification are recorded in [PHASE3B_REPORT.md](PHASE3B_REPORT.md).

`pnpm smoke:phase3b` runs real module services and authenticated HTTP rendering checks against an explicitly confirmed local database and running dev server. See the report and README for required environment variables. Run the full gates after integration. Use a placeholder DATABASE_URL for production builds. The Postgres settlement test is opt-in with `PAYMENTS_DB_TEST=local-only`; run it against an isolated local DB. Do not push or commit `.env`, `src/generated`, or `storage/`.
