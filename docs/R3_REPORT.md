# R3 integration report

R3 ran on `build/foundation`. The module-by-module changes span
`ea970b6..15c0167`, including `ea970b6` as the initial barrel removal. This final
integration removes the temporary shared entry points, enforces their absence,
and starts the production Postgres workflow worker. No dependencies or database
migrations changed in this integration.

## Commits and changes

- `ea970b6`: removed module barrel indexes and switched consumers to concrete files.
- `8bad459`: introduced TanStack DataTable, Popover/Command Combobox and RHF form helpers.
- `5e974e2`: added RHF item/variant, cost type and material recognition fields.
- `ad142e3`: migrated organization forms.
- `3d3c44d`: migrated masters forms and tables.
- `9f64666`: migrated payment forms and tables.
- `9711bcc`, `1600f26`: migrated vendor bills and retained file transport.
- `3844eae`: migrated sales invoices.
- `d4832f2`: installed Workflow SDK approval reminders and scoped in-app notifications.
- `da81849`: migrated projects, sites, budgets and teams.
- `7a6b35e`: migrated procurement and inventory.
- `376b671`: migrated tasks, attendance, project costs and workforce.
- `a89255c`: finished the shared UI sweep and flattened shared kit files.
- `15c0167`: migrated approvals policies, decisions, cancellation and tables.

Forms use RHF with Zod v4, explicit defaults and `ActionFormShell`; exported async
Server Functions call `typedAction` to validate raw input and apply transforms on
the server. Decimal/date semantics, authorization, transactions and redirects
remain in module services. Searchable single and multiple choices use
`ComboboxField`, with server picker functions for remote search. Table columns
live in client components; server views send serializable rows. Empty states and
simple lists use shadcn Empty/Item, and fields use shadcn Field.

Final cleanup deleted `src/components/shared/fields.tsx`,
`data-table/index.tsx`, `combobox/index.tsx`, `form/index.ts`, and the unused
select alias layer `form/select-field.tsx`, all beneath `src/components/shared`.
Its consumers now import concrete implementations. Multiple choices pass
`multiple` directly to `ComboboxField`. `action-form.tsx` remains in use.

The boundary script now rejects every `index.ts`/`index.tsx` file under
`src/modules/**` and `src/components/shared/**`, even if nothing imports it.
Its assertions cover root/nested indexes, Windows paths and allowed concrete/UI
files. Existing import rules and generated-code exclusions remain.

Integration commits before this report:

- `97d9c8e`: removed compatibility shims and added the index-file boundary rule.
- `0fd14a4`: validated the project picker purpose on the server.
- `80ce58d`: added and tested the Postgres instrumentation hook and documented deployment settings.

## FormData exceptions

- Organization auth sign-out retains the legacy action signature. It ignores both
  supplied state and FormData and delegates session invalidation to Better Auth.
  There is no user payload to parse or tenant mutation to scope.
- Procurement proforma attachments retain `ActionForm`/FormData for a File.
  Zod validates the order ID; project access and purchase permission are checked;
  explicit checks enforce PDF/PNG/JPEG and the existing 900 KB size limit.
- Vendor bill creation uses RHF metadata and FormData file transport.
  `billUploadInput` validates the FormData, bounded JSON metadata and attachment
  on the server. Separate attachments validate the bill ID and File schema.
- Task work submission retains FormData for multiple photos, with Zod metadata
  parsing in `work-service.ts`, project/task scope and task.submit permission.
  It allows up to ten JPEG/PNG/WebP photos of at most 20 MB each. Non-upload task
  operations use typed actions.

Files remain outside JSON object transport. Uploads preserve storage cleanup on
transaction failures. These are deliberate exceptions, not compatibility barrels.

## Production workflow worker

`src/instrumentation.ts` follows the installed Next.js instrumentation guides.
Its async `register()` runs only for Node with the exact Postgres world package
selected in the environment. It dynamically imports `workflow/runtime`, awaits
`getWorld()` and awaits optional `start()`. Errors fail initialization. It does
not start the local or Edge world or install competing shutdown handlers.

Installed source verification used `workflow@5.2.0` runtime exports and
`@workflow/core` getWorld/setWorld, plus `@workflow/world-postgres@5.0.3`
`dist/index.js`, `dist/queue.js` and README. getWorld returns a Promise. World
start initializes the memoized Graphile queue and re-enqueues active runs; the
queue defers its runner until the loopback executor is reachable. Next register
can therefore complete before HTTP readiness. The SDK owns normal shutdown.
The adjacent test injects a spec-compatible world with SDK setWorld and verifies
runtime/world gating, worker startup and propagation of startup failures.

Deployment still needs a long-lived Node process, world bootstrap migrations,
a reachable WORKFLOW_LOCAL_BASE_URL and ingress restrictions on the flow route.
The worker hook does not replace those deployment requirements. Keep the public
manifest and application-managed shutdown settings unset.

## Consistency review

Read all 37 files containing `"use server"`, including action wrappers, picker
endpoints and notifications queries. Followed delegated action calls into their
services and checked context helpers and approval engine authorization.
Mutation payloads use typedAction or explicit Zod parsing. Services enforce
organization/project/tenant ownership before mutation. Approval decisions use
engine eligibility; cancellation checks requester/admin identity. Notifications
are scoped to the authenticated user, tenant and organization.

Setup and sign-in intentionally run before authentication. Setup holds an
advisory transaction lock and only provisions the first user; sign-in uses
Better Auth. Super-admin tenant administration intentionally spans tenants.
Countries and states are global reference data; city searches retain tenant
scope. These are legitimate exceptions to tenant-scoped mutation requirements.

Async searches validate a maximum 150-character search value, enforce access
through permission/context checks or permission-filtered project queries, and
cap returned rows at 25, 30 or 50. Selected-record hydration functions use IDs,
not free-text search. Fixed the project picker's purpose discriminator by adding
explicit server Zod enum validation rather than relying on TypeScript alone.

The source sweep found no native select, SelectField, EnumOptions, shared/fields
reference, shared directory/index import or direct client import of a file with
a server-only sentinel. Bare module-path text remains only in two legitimate
checks: the boundary script's forbidden-path assertion, and the registry test's
interpolated concrete entry path. The registry entries all include server files.
The production build checks the compiled client/server imports as well.

## Known gaps

- Procurement item search filters/slices after loading all tenant picker items
  and UOMs. Returned options are bounded, but database work is not. Move filtering
  and pagination into the query in a separate feature change.
- Vendor bill receipt search calls getBillOrder/billOptions before filtering and
  slicing. That hydrates project, variant and UOM data beyond the returned page.
  A dedicated scoped receipt query should avoid that work.
- Several searches trim before checking max length; the normalized value is
  bounded but whitespace padding can exceed 150 raw characters.
- Approval workflow launch remains best effort after commit, with a crash window
  before start. Guaranteed launch needs an outbox. Caller-owned non-HTTP
  transactions must explicitly start the reminder after commit.
- This integration does not exercise a live Postgres worker restart, reminder
  delivery or authenticated browser flows. Earlier local workflow evidence is
  in PHASE3B_REPORT.md. Unit injection verifies the adapter, not queue delivery.
- The settlement database test remains opt-in with PAYMENTS_DB_TEST=local-only.
  No live database tests ran for this integration.

## Gates

- `pnpm exec tsc --noEmit`: passed, no diagnostics.
- `pnpm lint`: passed, 513 files checked, no fixes required.
- `pnpm check:boundaries`: passed, 508 source/script files checked.
- `pnpm test`: passed, 108 tests total, 107 passed, 0 failed, 1 skipped.
  The skipped test requires the explicit local settlement database opt-in.
- `pnpm build`: passed, 18 workflow steps and 1 workflow compiled, 60 pages
  generated. The generated flow/webhook routes and proxy are present.

No push was performed. Environment secrets, generated Prisma code, storage and
workflow data are excluded from the integration commits.

## Runtime verification

Verified on 2026-10-11 on `build/foundation`, using the existing localhost:3000
Turbopack server and the migrated/seeded isolated PostgreSQL instance on port
51265. Shells used the supplied local DATABASE_URL and BETTER_AUTH_URL; `.env`
was not edited. The server was neither restarted nor stopped. Smoke fixtures
remain in the database for inspection.

### Service smoke and settlement

`PHASE3B_SMOKE_CONFIRM=local-only pnpm smoke:phase3b` passed after fixing the
history-link assertion. Every expected accounting result matched:

- Receipt costs: P1 1000.00, P2 0.00; received quantities 10/20 on both POs.
- Consumption: P1 +0.00, P2 +200.00. Transfer: P1 -300.00, P2 +0.00.
- Vendor bill: payable 1053.00, variance -100.00; paid
  400.00 -> 1053.00 -> void -> 400.00; outstanding 653.00.
- Sale: payable 351.00, stock movement -2 / -200.00; receipt 351.00, PAID.
- Final P1 stock 5 / value 500.00 / cost 600.00; P2 stock 9 / value 900.00 /
  cost 200.00. Vendor balance and statement -653.00; customer balance 0.00.
- All 13 approval document links across 10 document types returned HTTP 200
  and rendered their expected document content. Unrelated negative cost entries
  and unconfirmed cost-recognition changes were rejected.

The successful smoke organization is `phase3b-1791719243573`; browser checks used
the first run's retained organization, `phase3b-1791719143844`.
The smoke log is `%TEMP%/r3-smoke.log`.

`PAYMENTS_DB_TEST=local-only pnpm exec node --import tsx --test
src/modules/payment/server/service.test.ts` passed: 1 test, 0 failures, no skips.
Its fixtures rolled back.

Standalone service calls logged best-effort reminder warnings: `after` lacks an
HTTP request scope, and plain tsx does not compile `use workflow` functions.
These calls do not verify queue delivery. The authenticated HTTP submission
below ran the compiled workflow successfully without an app change.

### Browser checks

T3's collaborative Chromium preview signed in as `phase3b@example.test` with
the throwaway smoke password. Screenshots are copied to `%TEMP%/r3-shots`,
outside the repository.

- **a PASS:** password Show/Hide changed the input type to text/password and
  retained the value; sign-in succeeded. Screenshot `sign-in.png`.
- **b PASS:** the city State combobox opened, local search for `Tamil` reduced
  the options and selecting Tamil Nadu set the field. Procurement item search
  for `Steel` returned no rows; `Smoke` returned `MATERIAL · Smoke material`.
  The server log confirmed `findProcurementItems` received those queries.
  Tax Components multi-select added CGST and SGST badges, then removed CGST
  by selecting it again, leaving SGST. Screenshots `local-combobox.png`,
  `purchase-request-two-lines.png`, `multiselect-added.png`, `multiselect-removed.png`.
- **c PASS:** CityForm saved `R3 runtime city` and showed it in the city table.
  Submitting an empty name displayed `Name is required.` beneath City name.
  ProjectForm created `PRJ-0001 · R3 runtime project` and rendered its overview.
  Procurement's useFieldArray added a second line, saved PR-0003 with quantities
  2 and 3 at rate 100, displayed both lines and total 500.00, then submitted it
  with status PENDING APPROVAL. Screenshots `validation.png`,
  `project-created.png`, `purchase-request-two-lines.png`.
- **d PASS:** approval history had 14 rows, 10 on page 1 and 4 on page 2.
  Next revealed PR-0001 and the other older documents. Searching PR-0001
  produced one row and reset pagination. Document sorting toggled ascending
  and descending, with the displayed row order changing accordingly.
  Empty city and new-project lists displayed their empty states.
  Screenshot `table-sorted.png`; `project-created.png` includes empty lists.
- **e PASS:** the vendor bill RHF form submitted payload JSON plus
  `r3-invoice.png`, creating BILL-0002, invoice `R3-runtime-upload-20261011`,
  a direct service line and payable 25.00. The attachment link opened;
  authenticated fetch returned HTTP 200, image/png, the filename and all 68
  original bytes unchanged. Screenshots `bill-upload.png`, `bill-saved.png`.
- **f PASS:** browser submission of PR-0003 created approval request
  `cmv3rh38u0007ywme270yborr` at 06:20:08.046 UTC. PostgreSQL contained three
  deterministic APPROVAL_REMINDER rows for the eligible organization owner,
  `phase3b@example.test`, at 06:20:27.850, 06:20:46.029 and 06:21:04.160 UTC.
  The bell showed 3 unread. Marking reminder 3 read reduced it to 2; PostgreSQL
  confirmed readAt 06:21:45.071 UTC. Generated workflow flow requests returned
  HTTP 200. Screenshot `notifications.png`.

### Fixes and final gates

`502caa8` fixes `scripts/phase3b-smoke-links.ts`. R3's history DataTable renders
only the first 10 rows in initial markup. The previous smoke wrongly required
every link to appear as a rendered anchor. It now accepts either the rendered
anchor or the serialized table row's href, then still fetches every destination
and asserts its rendered content. Browser pagination independently verified the
older links.

`394ef42` fixes the workspace error screen's Try again button. It used
Next 16.4's `reset()`, which re-renders the failed boundary without fetching
fresh server content. It now uses `retry()` as specified in the installed
`next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`.
The original database failure showed that reset sent no fresh GET. After the
fix, clicking Try again sent a new request. A temporary one-shot error in the
locations view then verified full browser recovery to the city table after one
click. The temporary probe was removed; no probe code was committed.

README now points approval integration to concrete policy, service,
authorization and handler files, removes the obsolete public-index description,
and documents the local reminder check and standalone smoke limitation.

- `pnpm exec tsc --noEmit`: PASS, no diagnostics.
- `pnpm lint`: PASS, 513 files, no fixes.
- `pnpm check:boundaries`: PASS, 508 files.
- `pnpm test`: PASS, 108 total, 107 passed, 0 failed, 1 opt-in settlement test
  skipped. That settlement test passed separately with the local opt-in above.
- Next `/_next/mcp` get_compilation_issues: PASS, no issues across routes.
  Initial get_errors: PASS, no configuration or browser-session errors before
  the late database failures and controlled retry probe described below.

The requested browser flows passed before a late repeat of the procurement
list encountered an environment limitation: `Connection terminated
unexpectedly` / Prisma P1017. The endpoint reports PostgreSQL 17.5 compiled
for `wasm32-unknown-linux-gnu`, and pg_stat_activity exposes one backend.
A standalone Prisma purchase-order query returned both orders sequentially;
15 concurrent copies reproduced P1017 outside Next. Fresh database reads,
including the notification query, still succeeded. The final procurement-list
repeat therefore FAILED on this local database. Its concurrency/connection
closure remains unresolved; no application pool or query workaround was added
without evidence that it applies to native PostgreSQL. `%TEMP%/r3-query.cjs`
and `r3-query-parallel.cjs` retain the isolated reproductions. Retry recovery
was separately verified with a controlled one-shot server error as above.

Production Postgres worker restart
and production deployment were not exercised; local reminder delivery uses the
bundled local world. Workflow launch remains best effort as documented above.
No production build was repeated because this change only touches the smoke
script, error-view callback and docs. No push occurred, and no environment file, generated Prisma
client, storage file, screenshot or workflow data was committed.
