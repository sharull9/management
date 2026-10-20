# Phase IV implementation plan

Implement the vehicles and machinery scope in `PLAN.md`. Phase V accounting is excluded and requires the user's approval after this phase. All delegated implementation uses GPT-6 Luna on `codex_codex_personal`, with at most four simultaneous subagents.

## Design

Assets belong to an organization. They record their type, meter, power source, equipment rate and applicable electrical specifications. Rates and fuel costs are expressed in organization base currency. Each log snapshots the rates used to calculate its cost. Existing currency helpers convert cost entries into project currency at the log date.

An asset can be allocated to one project at a time, with inclusive allocation dates. Logs must belong to that allocation and project and fit its dates. Trips use kilometre readings; usage logs use hour readings and start/end timestamps. Fuel efficiency is an estimate between successive fuel readings, using the current fill's quantity. No preceding reading or no meter movement produces no efficiency figure.

Server actions independently authorize every mutation. Asset management is organization-scoped; project log operations also check project access. Writes serialize per asset and update logs, costs and audits in one transaction. Editing replaces the corresponding costs; deleting removes them. Changes must preserve historical rate snapshots. Logs cannot be moved to another asset or project through an edit.

The UI extends the existing application style, shared form fields, tables and overlays. Organization asset lists and asset detail pages expose allocation, trip, usage and fuel histories. Project assets are reachable from the project workspace. Read-only users receive no mutation controls.

## Small implementation parts

1. Add models, an additive migration, typed input schemas, pure costing helpers and tests. Publish exact interfaces in `PHASE4_SHARED.md`.
2. Add scoped queries, transaction-aware services and server actions. Test authorization, allocation boundaries, log compatibility and cost replacement.
3. Add forms, tables, routes and navigation against the shared contract. Preserve installed Next.js Suspense and promise-param conventions.
4. Review integration, protect base-currency changes once asset rates exist, and verify the migration and services on an isolated local database.
5. Run schema validation, typecheck, lint, boundary checks, tests and production build. Check the running UI when local runtime prerequisites are available. Record outcomes and limitations in `PHASE4_REPORT.md`.

## Verification boundaries

Do not change `.env`, use remote databases for fixtures, rewrite applied migrations, commit or push automatically. The local test database is disposable. Database integration tests use opt-in guards and roll back their fixtures. Existing project costs, approvals and accounting behavior remain covered by the regression suite.
