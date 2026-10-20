# Phase IV report

Implemented on 2026-10-18 using GPT-6 Luna subagents through `codex_codex_personal`, with at most four active subagents. The coordinator integrated and reviewed their work. Phase V accounting has not started and requires user approval.

## Delivered

- Organization asset register for vehicles and machinery, kilometre/hour meters, diesel/petrol/electric/other power, active state, equipment rates and electrical specifications.
- Project allocations with inclusive date ranges, overlap protection, and safeguards against moving or shortening allocations around existing logs.
- Trip departure/return timestamps and odometer readings, usage timestamps and hour readings, and fuel quantity/cost/readings. Logs can be edited or deleted with matching ledger changes.
- Equipment costs from meter movement and snapshotted rates. Electric vehicle trips and machinery usage estimate kWh from elapsed time and kW rating, then electricity cost from the tariff.
- Fuel efficiency estimates in km/L or L/hr using the current fill and previous asset reading. The predecessor can belong to another project; only permitted records and sanitized estimates are returned to the UI.
- Atomic EQUIPMENT, FUEL and ELECTRICITY cost entries through the existing multi-currency helper, plus audit records. Editing replaces the relevant entries and preserves the original equipment/electrical rate snapshots.
- Organization asset list/detail screens, a project Assets tab, shared forms and tables, permissions, navigation and empty states. Inactive assets retain historical editing but cannot receive new logs.
- Additive migration `20261018100000_phase4_assets`, numeric checks and a database allocation-overlap trigger. Existing migrations are unchanged.

Asset management uses `asset.manage`; viewing uses `asset.view`; logging uses `asset.log`. Project managers receive project-scoped viewing/logging. Each action authorizes independently, and transaction-aware services check organization/project access again. Asset rates also lock the organization's base currency against later changes.

## Verification

- `pnpm prisma validate`: passed. Prisma Client regenerated.
- Final migration chain deployed successfully to a fresh isolated localhost Prisma Postgres instance; global reference data seeded successfully.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm check:boundaries`, `git diff --check`: passed.
- `pnpm test`: 214 tests, 211 passed, three opt-in database tests skipped, zero failures.
- Both new opt-in asset database suites ran separately with `ASSETS_DB_TEST=local-only`: passed. Their fixtures roll back. Coverage includes inclusive allocation overlap, access denial, inactive/meter checks, snapshot preservation, cost replacement/deletion, missing-FX rollback, INR-to-USD conversion, JPY rounding, and electric vehicle electricity costs.
- `pnpm build`: passed, including all three new asset route patterns.
- Independent review findings about stale pre-lock asset state, filtered fuel predecessors, meter ordering and zero-duration electric trips were fixed. Focused regression tests cover those rules.
- UI detector over `src/modules/assets/ui`: no findings. Next.js runtime diagnostics reported no configuration, session or compilation errors.

Browser checks used the collaborative T3 preview and a localhost dev server. The owner created a truck, allocated it and recorded a 20 km trip at INR 2.50/km; the UI showed INR 50. Electric vehicle fixtures showed INR 50 equipment and INR 60 electricity separately, with 20 kWh. Read-only users had no mutation controls and saw no restricted-project rows. Their visible fuel estimate still used the prior asset fill from the restricted project. Project manager navigation and logging controls were checked through the project Assets route. A 390 px viewport kept page overflow inside the tables.

## Operational notes and limits

### Follow-up preview verification

The requested follow-up used T3 preview interactions against the isolated local fixtures. A project manager's trip form rejected a return before departure, then saved a 10 km trip at INR 25. Editing the distance to 20 km replaced its cost with INR 50. Confirming deletion removed the log and its ledger entry; the project ledger returned from eight entries / INR 3,297.50 to seven entries / INR 3,247.50. Machinery showed INR 12.50 equipment and INR 75 electricity; the electric vehicle showed INR 50 equipment and INR 60 electricity.

Read-only controls and restricted-project filtering passed again. At 390 px, the shared header search overlapped the breadcrumb. The trigger now becomes an accessible search icon on narrow screens, and its container can shrink. Preview confirmed no header overlap or page overflow at 390 px and 1280 px, and search still opens. Focused Biome and TypeScript checks passed after that responsive fix.

- Apply the new migration before running this version against an existing database, then regenerate Prisma and restart the app. No migration or fixtures were applied to the configured remote database, and `.env` was not changed.
- Prisma rejected resetting the first disposable database. Verification continued on a new isolated local instance without bypassing the reset safeguard.
- Trip and usage inputs and allocation coverage use UTC calendar dates; timestamp fields and history label UTC explicitly.
- Fuel efficiency and electricity are estimates. No tank-level calibration, telematics, maintenance scheduling, depreciation, accounting journals or Phase V reports were added.
- Asset lists/history currently load their accessible records before table pagination. Large-dataset load testing and concurrent browser sessions were not stress-tested. The older opt-in settlement suite was not rerun in this phase.
- Changes remain uncommitted and have not been pushed or deployed. Local verification fixtures remain in the isolated test database for inspection.

## Rerun the database tests

Use an isolated localhost database with all migrations deployed and the base seed applied. Set its `DATABASE_URL` in the test shell, without editing `.env`, then run:

```powershell
$env:ASSETS_DB_TEST = 'local-only'
pnpm exec node --import tsx --test src/modules/assets/server/integration.test.ts src/modules/assets/server/scope-fx.test.ts
```

The guard rejects remote hosts. Test fixtures are transaction-local and roll back even when assertions fail.
