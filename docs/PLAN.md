# Project Management & Costing Platform — Build Plan

Stack: Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript, Tailwind v4,
shadcn/ui (Radix "nova" preset, `src/components/ui`), Prisma 7 (`prisma-client` generator,
`@prisma/adapter-pg`), PostgreSQL, Better Auth 1.7 (admin + organization plugins), zod 4, Biome.

> Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before writing
> route code. Key rules: `params`/`searchParams` are Promises; reading `cookies()`/`headers()`/
> `params` or querying the DB must happen inside a `<Suspense>` boundary (or a `loading.tsx`
> segment) or the build fails; `middleware` is now `proxy.ts`; use `refresh()` / `revalidatePath`
> from `next/cache` in Server Actions after mutations.

---

## Core design decisions

### Tenancy
- **Super admin** (platform owner, Better Auth `admin` plugin, `user.role = "admin"`): creates and
  suspends tenants and their owner accounts. Public sign-up is disabled. `/setup` creates the first
  super admin only when the `user` table is empty.
- **Tenant** = our client. Owns *shared master data*: items, item levels, UOMs, categories,
  parties (vendor/customer), tax setup, cities, worker designations, roles.
- **Organization** (Better Auth `organization` model + `tenantId`) = a sub-company / whatever the
  tenant needs. Owns *transactions*: projects, workers, attendance, costs, approvals, purchases,
  assets, accounts. Org creation is done by our own server actions (Prisma), not the Better Auth
  endpoint (`allowUserToCreateOrganization: false`).
- **Users**: `TenantMember` (OWNER/ADMIN/MEMBER) + Better Auth `member` per org (role
  owner/admin/member) + optional custom `roleId` (permission checklist) + optional per-project role
  (`ProjectMember`). Tenant OWNER/ADMIN and org owner/admin bypass permission checks.
- Permissions are string keys defined in code (`src/lib/permissions.ts`), e.g. `project.view`,
  `project.create`, `task.manage`, `task.submit`, `attendance.record`, `expense.create`,
  `approval.policy.manage`, `settings.manage`, `workforce.manage`, `masters.manage`, …

### Workers
Workers are **not users** and never log in. Managers record attendance, task work and
submissions for them. Designations (Worker, Mason, Electrician…) are a tenant master.

### Item levels 1–5
- `ItemLevelDefinition` (tenant): name each level once (L1 = Brand, L2 = Grade, L3 = Size…).
- `ItemLevelValue` (tenant, per level): e.g. Brand → UltraTech, ACC.
- Per item and level, `ItemLevelConfig.mode`: `NOT_USED` | `ANY` (any value of that level) |
  `LINKED` (only values linked through `ItemLevelLink`); plus `required`.
- `ItemVariant` = item + chosen level values (level1..level5 nullable), unique by a computed `key`
  string. Stock and transaction lines reference variants.

### UOM
`UomGroup` (Volume, Weight, Count…) with `Uom` rows (`factor` to the group's base unit, `isBase`).
`tenantId = null` rows are system defaults; tenants can add their own. Items have `stockUomId` and
optional `purchaseUomId`.

### Parties (vendor / customer / both)
One `Party` (tenant): legal name, display name, `isVendor`, `isCustomer`, type, contacts,
addresses, tax ids, payment terms, credit limit. A project can link a customer as its client.

### Global tax
- `TaxComponent` (CGST 9%, SGST 9%, IGST 18%, VAT 5%, TDS 2% with `isWithholding`).
- `TaxGroup` bundles components; optional `countryId` and `scope` (`INTRA` | `INTER` | `ANY`).
- `TaxIdentifier` generic (label + value, e.g. GSTIN / PAN / VAT / EIN) for orgs and parties.
- Items carry a generic `taxCode` (HSN/SAC) and optional default tax group.
- Documents snapshot tax lines (name, rate, amount) at creation time.
- Later: auto-pick INTRA vs INTER by comparing org state and party state.

### Locations
`Country` and `State` are global (seeded). `City` is tenant-scoped. Project sites, party
addresses and orgs reference them.

### Approval engine (one engine for every document type)
- `ApprovalPolicy` per `documentType` (TASK_SUBMISSION, TASK_DELAY, EXPENSE, PURCHASE_REQUEST,
  PURCHASE_ORDER, GRN, VENDOR_BILL, PAYMENT_REQUEST, STOCK_TRANSFER, …); scope = org default,
  overridable per project and per stage (most specific active policy wins).
- `ApprovalPolicyStep`: ordered; approver = `ROLE` | `USER` | `PROJECT_MANAGER` | `STAGE_MANAGER`;
  optional `minAmount` (step only applies when document amount ≥ minAmount); a display name
  ("Verification", "Approval").
- On submit, steps are **snapshotted** into `ApprovalRequestStep` rows. No policy → single
  PROJECT_MANAGER step (fallback: org owner/admin).
- Actions: approve (advance / complete), reject (back to requester with comment), cancel.
- A handler registry (`src/server/approvals/handlers.ts`) runs per documentType on final
  approve/reject (e.g. task → COMPLETED / REWORK, delay → update due date, expense → post cost).
- Approvals inbox lists steps the current user can act on.

### Project cost ledger
`CostEntry`: org, project, stage?, task?, date, `costType` (LABOUR, MATERIAL, EQUIPMENT, FUEL,
ELECTRICITY, SUBCONTRACT, OVERHEAD, OTHER), amount, description, `sourceType` + `sourceId`.
Every module posts here; budget vs actual reads from here. Accounting (phase 5) generates journals
from the same source documents.

### Cross-cutting
`AuditLog` (all creates/updates/approval actions), `DocumentSeries` (per-org numbering,
e.g. `PRJ-0001`), `Attachment` (polymorphic entityType/entityId) with a storage abstraction
(`src/server/storage.ts`; local disk under `./storage` for now, S3/R2 later).

### Money & quantities
`Decimal(18,2)` for money, `Decimal(18,4)` for quantities/rates. Org has `baseCurrency`
(default INR). Never use floats for money in app code (use Prisma Decimal / string math).

---

## Phases

Each phase ends with: `pnpm prisma validate`, `pnpm prisma generate`, `pnpm tsc --noEmit`,
`pnpm lint`, `pnpm build` passing, and a commit. Development DB: `DATABASE_URL` in `.env`
(placeholder until the real URL is provided; `pnpm prisma dev` can provide a local Prisma
Postgres for testing migrations).

### Phase 0 — Setup ✅
Dependencies, shadcn init + components, Prisma config, env example, this plan.

### Phase 1 — Foundation ✅
- Full Prisma schema for: Better Auth models (user/session/account/verification/organization/
  member/invitation incl. admin + organization plugin fields), Tenant, TenantMember, Role,
  ProjectMember, Country/State/City, UomGroup/Uom, ItemCategory, Item, ItemLevelDefinition,
  ItemLevelValue, ItemLevelConfig, ItemLevelLink, ItemVariant, Party (+ address/contact),
  TaxComponent/TaxGroup/TaxGroupComponent/TaxIdentifier, ApprovalPolicy/Step,
  ApprovalRequest/Step, AuditLog, DocumentSeries, Attachment, Designation.
  (Project/workforce/cost models land in phase 2.)
- Initial migration (`prisma migrate dev --create-only` if no DB reachable) and seed
  (countries/states for India + a few others, system UOMs).
- `src/server/db.ts` Prisma client singleton; `src/lib/auth.ts` Better Auth config;
  `src/lib/auth-client.ts`; `src/app/api/auth/[...all]/route.ts`; `src/proxy.ts` optimistic
  redirect for unauthenticated users.
- Data-access layer `src/server/context.ts`: `requireUser()`, `requireSuperAdmin()`,
  `requireOrgContext(orgSlug)` → { user, tenant, org, member, permissions },
  `assertPermission()`.
- Approval engine service (`src/server/approvals/`) with policy resolution, snapshot, approve,
  reject, handler registry, unit-testable pure functions.
- Audit log + document numbering helpers.
- UI: `/setup`, `/sign-in`, `/admin` (tenants list, create tenant + owner account, suspend),
  `/` org picker / onboarding (create first org), app shell with sidebar + org switcher under
  `/[org]`, Settings: organizations, members (create user + add to org with role), roles &
  permissions, approval policies (per document type, steps editor), document series.
  Locations: countries/states (read-only list), cities CRUD.

### Phase 2 — Projects, workforce & cost (core) ✅
- Schema: Project, ProjectSite, ProjectBudgetLine, Stage, Task, TaskAssignment, TaskSubmission,
  TaskDelayRequest, Worker, ProjectWorker, Attendance, Expense, CostEntry.
- Projects list/create/edit; overview dashboard (budget, spent, remaining, cost by type & stage,
  task progress, pending approvals); sites; budget lines; project members & managers.
- Stages CRUD with sequence, dates, status, stage manager.
- Tasks: list/board per stage, detail page, worker assignment, status flow
  TODO → IN_PROGRESS → SUBMITTED → COMPLETED / REWORK, submissions (note, progress %,
  attachments) through the approval engine, delay requests through the approval engine.
- Workforce: designations, workers (pay type MONTHLY/DAILY/HOURLY, salary, cost days/month
  default 30, standard hours/day, OT multiplier), project assignment with date range, day-rate
  override and OT rate, availability view with overlap warnings.
- Attendance grid per project/date (PRESENT/HALF_DAY/ABSENT/LEAVE, OT hours) → automatic LABOUR
  cost entries (day rate = override ?? salary ÷ cost days; OT = hours × day rate ÷ std hours ×
  multiplier).
- Manual expenses → approval → cost entry. Approvals inbox page. Org dashboard.

Implemented with grouped task lists and sequence-number stage reordering. Budget actuals match
cost type and stage; duplicate budget lines share that actual and are combined for totals.
Attendance posts unallocated project labour costs. Monthly dashboard totals are separated by
project currency; this phase does not convert currencies. See `PHASE2_REPORT.md` for validation.

### Phase 3a — Masters UI, purchasing up to GRN & project inventory ✅
- Tenant master CRUD: UOM groups/units, category tree (depth 5), enabled item levels 1–5 and values,
  items with required ANY/LINKED configs and resolved variants, parties/addresses/contacts/tax IDs,
  tax components/applicability and country/scoped groups. System UOM rows are read-only.
- PR draft/edit → submit estimated total → approval. PO direct or approved PR lines from one
  project, vendor, net rates/discount, individual tax snapshots, credit/cash/advance terms,
  proforma attachment → submit grand total → approval. Multiple partial GRNs → approval → stock.
- Approved receipts enforce cumulative quantities plus configurable tolerance (0% default).
  Accepted quantities convert to stock UOM; rejected quantities create no stock. Physical receipts
  determine PO completion and accepted totals remain separately visible.
- `MATERIAL_COST_RECOGNITION = "ON_CONSUMPTION"`: GRN adds inventory at discounted net cost
  excluding tax. Consumption withdraws at weighted average and posts MATERIAL cost per line.
  Approved transfers post opposite stock quantities/value, without CostEntry.
- Organization Procurement/Inventory sidebar groups, scoped lists and document detail/timelines,
  project Materials tab, multi-line item/level picker, stock balances and consumption history.
  Existing approval registry, scoped manager resolution, transactions, audit and numbering reused.
- Stock movements cannot predate existing project/variant movements. POs use project currency;
  transfers require equal currencies and access to both projects. Referenced UOM factors/item stock
  settings are protected. Private proforma uploads currently cap at 900 KB. Browser print CSS added.
- See `PHASE3A_REPORT.md` for tests, smoke verification, command outcomes and implementation limits.

### Phase 3b — Bills, payments, advances & sales (pending)
- Vendor Bill against PO/GRN lines (actual price, discounts, tax, withholding) → approval →
  Payment Request → approval → Payment (cash/bank, partial).
- Advances are unallocated payments allocated later to bills. Vendor balance view.
- Basic customer invoices for goods/services and project client billing.
- Attach to the existing typed PO/GRN/line IDs and tax snapshots. Preserve consumption-based material
  cost recognition; define price-variance/revaluation treatment when bills differ from PO prices.

### Phase 4 — Vehicles & machinery
- `Asset` (type VEHICLE/MACHINE, meter KM/HOURS, power DIESEL/PETROL/ELECTRIC/OTHER, kW rating,
  tariff), project allocation with date range, trip log (out/in, odometer), usage log
  (start/end time, hour meter), fuel log (qty, cost, reading → km/L or L/hr), electric estimate
  (hours × kW × tariff). All post EQUIPMENT/FUEL/ELECTRICITY cost entries.

### Phase 5 — Accounting
- Chart of accounts (tenant template, per-org accounts), auto journal posting from bills,
  payments, GRNs, consumption, payroll costing, manual journal entries with approval, ledgers,
  trial balance, P&L, balance sheet, tax reports.
