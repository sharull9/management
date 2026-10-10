# Management

Multi-tenant project management and costing. Phase 1 provides authentication,
tenant administration, organization workspaces, shared reference data, settings,
and a document approval engine. Project and transaction modules arrive in later phases.

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
pnpm test              # Money thresholds, snapshots, fallback and step advancement
pnpm build
pnpm start
```

For production, set the environment variables, run `pnpm prisma migrate deploy`, seed
the database, then build and start. The build does not connect to the database.
Keep PostgreSQL and persistent `storage/` available at runtime. Files are private;
future attachment routes must authorize the organization before calling the storage helper.

## Access model

- Platform administrators have `User.role = admin`. They create/suspend tenants in `/admin`.
- Tenants own roles and shared masters. Tenant OWNER/ADMIN users can enter every organization
  in that tenant and create/edit organizations.
- Organizations own approvals, numbering and attachments. Members have a Better Auth base
  role and an optional tenant custom role. Org owner/admin and tenant OWNER/ADMIN bypass
  permission checks. Other members receive the custom role's permission keys.
- `src/server/context.ts` verifies sessions, tenant membership, org access, suspension and
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
- `/[org]/projects` and `/[org]/workforce` placeholders for the next phase.

## Approval integration for later phases

`src/server/approvals/service.ts` exports `resolvePolicy`, `submitForApproval`,
`actOnApproval`, `cancelApproval`, `listPendingForUser`, and `registerManagerResolver`.

After a document action validates and authorizes its domain operation, call
`submitForApproval({ orgSlug, documentType, documentId, title, amount, projectId, stageId })`.
Use decimal strings for money. An optional transaction lets submission share a transaction
with the document write. Policy lookup selects active stage, project, then organization policies.
Steps are filtered by minimum amount and copied into independent request snapshots.
No applicable steps produce a PROJECT_MANAGER step, falling back to an organization or tenant
administrator when no manager resolves.

Register `registerApprovalHandler(documentType, { onApproved, onRejected })` from a server
bootstrap imported by `handlers.ts`. Both callbacks receive the request and the current Prisma
transaction. Write document status and cost entries using that transaction. Do not make external
network calls inside it. Unregistered document types remain generic approvals with no domain
side effects. Register a manager resolver when project/stage models arrive; return user IDs or
`null` for the admin fallback.

Approval decisions lock the request, recheck the pending step, update its actor/comment,
advance or finalize, call the handler and audit within one transaction. Duplicate pending
submissions are prevented by a document lock and a partial unique index. Completed/rejected
documents may be submitted again as a new request. Policy edits do not alter existing snapshots.

Project/stage scope IDs are nullable strings until Phase 2 adds their models and foreign keys.
The UI disables project/stage scopes for now. `ProjectMember` is deliberately deferred.
Add document enum values and handlers as subsequent workflows are introduced.

## Structure

```text
prisma/
  schema.prisma           Auth, tenancy and foundation master/service models
  migrations/             Initial schema plus SQL integrity constraints
  seed.ts                 Global locations and system units
src/app/
  (app)/                  Static layout and loading boundary
    [org]/                Authenticated shell, dashboard, settings and masters
  api/auth/[...all]/       Better Auth route handler
  setup/, sign-in/         First-run setup and login
src/components/           Forms, fields, shell and ordered policy editor
  ui/                     shadcn components
src/lib/                  Auth/client config, permission catalog and utilities
src/server/
  db.ts                   PrismaPg singleton
  context.ts              Session and tenancy DAL
  actions.ts              Zod-validated server mutations
  approvals/              Policy lookup, authorization, logic, handlers and service
  audit.ts                Transaction-aware audit writer
  numbering.ts            Atomic document number allocation
  storage.ts              Private local file storage abstraction
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
