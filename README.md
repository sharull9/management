# Management

Multi-tenant project management and costing. Phase 1 provides authentication,
tenant administration, organization workspaces, shared reference data, settings,
and a document approval engine. Phase 2 adds projects, stages, tasks, worker assignments,
attendance costing, approved expenses, budgets, sites and organization dashboards.
Phase 3a adds shared master screens, purchase requests and orders, approved goods receipts,
project stock, material consumption costing and approved inter-project transfers.
Phase 3b adds vendor bills, payment requests, partial settlements, advances, voids,
customer invoices, stock sales and per-project material cost recognition.

## Run locally

Requires Node 24, pnpm 11 and PostgreSQL. Dependency versions are pinned in the lockfile.

1. Copy `.env.example` to `.env` before installing, because `postinstall` generates Prisma's client.
2. Set `DATABASE_URL` to a PostgreSQL connection string, `BETTER_AUTH_URL` to your app's origin,
   and `BETTER_AUTH_SECRET` to a random secret of at least 32 characters.
   Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
3. Run:

```powershell
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000/setup` to create the first platform administrator.
Setup closes once any user exists. Sign in, create a tenant and its owner, then sign in
as that owner to create the first organization. Public sign-up is disabled.
New users require temporary passwords of at least 12 characters. Adding an existing
email retains that account's password.

For a local development database, `pnpm prisma dev --detach` prints a PostgreSQL URL.
Use that URL in the current shell without changing `.env`:

```powershell
$env:DATABASE_URL = '<URL printed by prisma dev>'
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed can be repeated. It creates nine countries, all 28 Indian states and eight
union territories, five US states, seven UAE emirates, and six system UOM groups with
19 units. System Box has a neutral factor of 1; use a tenant unit for a specific pack size.
Factors use four decimal places, so sqft conversions are rounded to that precision.

## Commands

```powershell
pnpm db:generate       # Regenerate src/generated/prisma
pnpm db:migrate        # Create/apply development migrations
pnpm db:seed           # Idempotent global location and UOM seed
pnpm db:studio         # Inspect data
pnpm prisma validate
pnpm exec tsc --noEmit
pnpm lint
pnpm format
pnpm check:boundaries  # Enforce public module imports
pnpm test              # Approvals, costing, procurement, sales and settlement guards
pnpm smoke:phase3b     # Authenticated local DB workflow; environment below
pnpm build
pnpm start
```

For production, set the environment variables, run `pnpm prisma migrate deploy`, seed
the database, then build and start. The build does not connect to the database.
Keep PostgreSQL and persistent `storage/` available at runtime. Files are private;
the attachment download route authorizes the organization and project before reading storage.
Restart the dev server after regenerating Prisma for a schema change so all route modules use
the new client. `PRISMA_SHADOW_DATABASE_URL` optionally selects a separate shadow database,
which is useful with Prisma dev's separate TCP shadow endpoint.

## Phase 3b local smoke

Use an isolated localhost PostgreSQL database. The harness creates tenants and documents
and retains them for inspection. It updates the password of `phase3b@example.test`.
Do not run it against a database containing an account you need to preserve.

Set these variables in both the dev-server shell and smoke shell, without editing `.env`:

```powershell
$env:DATABASE_URL = '<localhost PostgreSQL TCP URL>'
$env:BETTER_AUTH_URL = 'http://localhost:3000'
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev
```

In the smoke shell, also set:

```powershell
$env:PHASE3B_SMOKE_CONFIRM = 'local-only'
$env:PHASE3B_SMOKE_PASSWORD = '<throwaway password of at least 12 characters>'
pnpm smoke:phase3b
$env:PAYMENTS_DB_TEST = 'local-only'
pnpm exec node --import tsx --test src/modules/payment/server/service.test.ts
```

The harness signs in over HTTP, runs real services with the session cookie, checks
all ten approval document links in the inbox/history, and verifies rendered document
content. Node-only hooks replace `next/headers` and the `server-only` sentinel in this
process. The settlement test rolls back its fixtures. Neither command changes `.env`.

## Access model

- Platform administrators have `User.role = admin`. They create/suspend tenants in `/admin`.
- Tenants own roles and shared masters. Tenant OWNER/ADMIN users can enter every organization
  in that tenant and create/edit organizations.
- Organizations own approvals, numbering and attachments. Members have a Better Auth base
  role and an optional tenant custom role. Org owner/admin and tenant OWNER/ADMIN bypass
  permission checks. Other members receive the custom role's permission keys.
- `src/core/context.ts` verifies sessions, tenant membership, org access, suspension and
  permissions. Each server action authorizes independently; the proxy only checks cookie presence.
- Organization writes use application actions. Better Auth's equivalent mutation endpoints are
  disabled so they cannot bypass tenant boundaries or last-owner protection.
- Tenant suspension blocks workspace reads and mutations. It does not delete accounts or data.

## Routes

- `/setup`, `/sign-in`, `/admin`, `/` organization picker and onboarding.
- `/[org]` workspace dashboard and responsive sidebar with organization switcher and sign-out.
- `/[org]/approvals` pending steps, approve/reject with comments, cancellation and request history.
- `/[org]/settings/{organizations,members,roles,approval-policies,numbering}`.
- `/[org]/masters/locations` global country/state lists and tenant city CRUD.
- `/[org]/masters/{uoms,categories,levels,items,parties,tax}` shared master CRUD, configs and variants.
- `/[org]/procurement/{requests,orders,receipts}` organization lists and draft forms; each has
  `/[documentId]` detail, draft editing, submission and approval timelines. `?projectId=` scopes lists.
- `/[org]/procurement/bills` and `/[billId]` vendor bill drafts, approval and attachments.
- `/[org]/finance/{payment-requests,payments,balances}` settlements, advances, voids and statements.
- `/[org]/sales/{invoices,receipts}` customer invoice approval and incoming payment flows.
- `/[org]/inventory/{stock,consumption,transfers}` stock balances, consumption history/forms and
  transfers; transfers have `/[documentId]` detail and approval. `?projectId=` scopes these pages.
- `/[org]/projects` filtered list and project creation, including quick customer creation.
- `/[org]/projects/[projectId]` overview and project editing, with `stages`, `tasks`, `team`,
  `attendance`, `costs`, `budget`, `sites` and `materials` subroutes.
- `/[org]/projects/[projectId]/tasks/[taskId]` worker assignments, work submission/photos,
  delay requests, approval timelines and task history.
- `/[org]/workforce` worker/designation management and date-range availability.
- `/api/attachments/[attachmentId]` private task photo downloads.

## Approval integration for later phases

`@/modules/approvals` exports `resolvePolicy`, `submitForApproval`,
`actOnApproval`, `cancelApproval`, `listPendingForUser`, and `registerManagerResolver`.

After a document action validates and authorizes its domain operation, call
`submitForApproval({ orgSlug, documentType, documentId, title, amount, projectId, stageId })`.
Use decimal strings for money. An optional transaction lets submission share a transaction
with the document write. Pass the already verified `OrgContext` as the third argument when
using a transaction, avoiding repeated session/DAL reads while its database connection is held.
The service checks organization/project/stage consistency. Policy lookup selects active stage,
project, then organization policies.
Steps are filtered by minimum amount and copied into independent request snapshots.
No applicable steps produce a PROJECT_MANAGER step, falling back to an organization or tenant
administrator when no manager resolves.

Register `registerApprovalHandler(documentType, { onApproved, onRejected, onCanceled })` in
`src/modules/approvals/server/register.ts`, imported by the approval service. Callbacks receive the
request, current Prisma transaction and actor ID. Write document status and cost entries using
that transaction. Do not make external
network calls inside it. Unregistered document types remain generic approvals with no domain
side effects. The registered resolver uses Project.managerUserId and ProjectMember.isManager
for PROJECT_MANAGER, and Stage.managerUserId for STAGE_MANAGER, with the administrator fallback
when no manager resolves. TASK_SUBMISSION completes the task or returns it for rework; TASK_DELAY
updates the due date when approved; EXPENSE posts one cost entry when approved. Cancellation
updates each source document and returns a submitted task to IN_PROGRESS.

Approval decisions lock the request, recheck the pending step, update its actor/comment,
advance or finalize, call the handler and audit within one transaction. Duplicate pending
submissions are prevented by a document lock and a partial unique index. Completed/rejected
documents may be submitted again as a new request. Policy edits do not alter existing snapshots.

Project/stage scope IDs now have foreign keys. The policy editor enables organization, project
and stage scopes and validates ownership. Expenses pass their Decimal amount for threshold steps.

## Project access and costing

Project members can view their project without an organization-wide project permission. A
project manager can edit the project and manage its stages, tasks, attendance, costs and team.
Project custom roles add permissions only within that project. The DAL and every action check
organization/project ownership independently. Worker and designation writes require
`workforce.manage`; workers remain separate from login users.

Attendance uses Prisma Decimal with 48-digit calculation precision. The day rate is the
assignment override, otherwise monthly salary divided by cost days, daily salary, or hourly pay
multiplied by standard hours. Present counts one day, half-day counts half, absent/leave count
zero base pay. OT hours multiply the hourly override or day rate divided by standard hours and
multiplied by the OT multiplier. Day and OT costs round half up to two places; their sum is the
posted total. Hours worked are recorded separately and do not replace the attendance status factor.

Saving attendance upserts its LABOUR cost entry in the same transaction. Editing replaces that
entry and deleting removes it. Costs are snapshots, so later salary/rate edits do not change
already saved attendance until it is explicitly saved again. Assignment date ranges are inclusive.
Inactive workers are blocked; overlaps between projects need explicit confirmation. Overlapping
rate assignments within the same project are blocked to keep the rate selection unambiguous.

Budget actuals match cost type and stage. Duplicate lines share those actuals and are combined
for totals. Attendance labour has no stage allocation. Project currency labels are stored as
entered; currency conversion is outside Phase 2. Dashboard monthly totals are shown per currency.
Use rate overrides expressed in the project's currency when the worker's base pay currency differs.

See [the Phase 2 report](docs/PHASE2_REPORT.md) for commands, smoke checks and implementation choices.

## Purchasing and materials

Masters belong to the tenant and require `masters.manage`. System UOM groups/units are read-only;
tenant groups are created with one base unit. Referenced conversion factors and item stock settings
cannot change. Categories allow five levels; item level definitions independently enable levels 1–5.
Items configure required ANY/LINKED levels; variant resolution validates choices and reuses a computed
key. PRODUCT/RAW_MATERIAL forms initially track stock; SERVICE forms initially do not. Parties can be
vendors and customers together, with multiple addresses, contacts and labeled tax identifiers.

PR drafts submit their estimated total for approval. POs accept direct lines or approved PR lines
from the same project; allocations cannot exceed the PR quantity. The vendor must belong to the
tenant and have `isVendor`. PO snapshots preserve net rates, conversion factors and individual tax
components. Taxes round half up per component to two places, with withholding shown separately and
deducted from the grand total. The form suggests INTRA/INTER from organization and default vendor
address states; the server rejects a conflicting explicit scope. Unknown states suggest ANY.

GRNs receive in the PO line UOM, with accepted + rejected = received. Approval checks cumulative
physical receipts against ordered quantity plus the PO tolerance (default 0%). Accepted stock alone
posts GRN_IN in stock UOM. Physical receipts, including rejected quantities, determine PO receipt
completion; accepted totals remain separate. Rejected quantities do not create stock.

`MATERIAL_COST_RECOGNITION = "ON_CONSUMPTION"` is defined in
`src/server/procurement/calculations.ts`. GRNs post no project cost. Material consumption withdraws
on-hand stock at weighted-average cost and creates one MATERIAL CostEntry per consumption line,
with stage/task allocation, in the same transaction. Transfers approve at the source average and
post equal opposite stock value without CostEntry. Both projects must belong to the org and use
the same currency. Stock movements cannot predate an existing movement for that project/variant;
same-date entries follow posting order. Quantities use four decimal places; inventory value and
unit-cost snapshots use eight; CostEntry amounts round half up to two.

Project access and custom roles apply to every action and list. Managers receive purchasing and
inventory permissions within their projects. Transfer creation/submission checks both projects.
Read-only users see no mutation forms. Purchase visibility uses `purchase.view`; stock visibility
uses `inventory.view`, with separate request/order/GRN/consume/transfer permissions. Existing legacy
permission keys remain in the catalog; new screens use the explicit Phase 3a keys.

PO detail supports printing through the browser and private PDF/PNG/JPEG proforma attachments up to
900 KB, within Next's existing 1 MB action body limit. Vendor bill copies use the same limit.
See [the Phase 3a report](docs/PHASE3A_REPORT.md) and [the Phase 3b report](docs/PHASE3B_REPORT.md).

## Structure

```text
prisma/
  schema.prisma           Auth, masters, projects, procurement, finance, stock and cost models
  migrations/             Initial schema plus SQL integrity constraints
  seed.ts                 Global locations and system units
src/app/
  (app)/                  Static layout and loading boundary
    [org]/                Authenticated shell, dashboard, settings and masters
  api/auth/[...all]/       Better Auth route handler
  setup/, sign-in/         First-run setup and login
src/components/           Forms, fields, shell and ordered policy editor
  ui/                     shadcn components
src/lib/                  shadcn class-name utility
src/core/                 Auth, Prisma, context, permissions, decimal math, audit, numbering, storage
src/modules/              Feature server code, schemas, types, UI and public indexes
src/generated/prisma/     Generated and ignored
storage/                  Runtime files, ignored
```

Next.js 16.4 has Cache Components and partial prefetching enabled. Request/DB reads live
inside Suspense and segment loading boundaries. Do not move those reads into the static app
layout or enable shared caching for authorization data. Read installed Next.js guides before
adding routes. Prisma's schema uses snake_case table mappings and decimal columns for money
and rates; SQL-only checks and the partial index are maintained in the integrity migration.

See `docs/PLAN.md` for the design and later phases. `.env`, generated clients, test database
credentials and stored attachments are never committed.
