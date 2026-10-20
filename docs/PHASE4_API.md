# Phase IV backend and UI interfaces

Concrete paths below belong to `src/modules/assets`. Input schemas and database fields are defined in `PHASE4_SHARED.md`.

## Registry and query part

`server/registry-service.ts` exports `saveAsset(tx, ctx, input)`, `saveAllocation(tx, ctx, input)` and `deleteAllocation(tx, ctx, allocationId)`. `ctx` is an authenticated `OrgContext`. Each service independently enforces its permission and organization ownership. Save functions return the saved Prisma row.

`server/actions.ts` exports `saveAssetAction(org, input)`, `saveAllocationAction(org, input)` and `deleteAllocationAction(org, {id})`. They return the existing `ActionState`, use typed input validation and own the transaction. Allocation actions verify project access independently.

`server/queries.ts` exports:

- `listAssets(org, projectId?)`: `{ctx, assets, projects, canManage, canLog}`. Assets include allocations with `project: {id, name, code}`. Projects are the accessible allocation targets. Optional project filtering must not expose another project's allocations.
- `assetDetail(org, assetId, projectId?)`: `{ctx, asset, projects, canManage, canLog}`. Asset includes allocations with project, trips with project, usages with project and fuelLogs with project. Histories are restricted to accessible projects; optional project filtering further narrows them. Fuel efficiency is calculated from the full asset history internally, but hidden project rows must never be returned to clients.

Query return values may contain Prisma Decimals and Dates in Server Components. Convert these to strings before passing data to Client Components. UI computes displayed efficiency from the permitted fuel rows or uses an explicitly sanitized server result. No guessed persisted efficiency columns.

## Log part

`server/log-service.ts` exports `saveTrip(tx, ctx, input)`, `saveUsage(tx, ctx, input)`, `saveFuelLog(tx, ctx, input)`, `deleteLog(tx, ctx, {kind, id})`. Kind is `TRIP | USAGE | FUEL`. Save functions return the saved Prisma row. Services validate `asset.log`, organization/project consistency, allocation coverage, mode and readings, preserve rate snapshots on edits and synchronize cost entries and audits using the same transaction.

`server/log-actions.ts` exports `saveTripAction(org, input)`, `saveUsageAction(org, input)`, `saveFuelLogAction(org, input)` and `deleteLogAction(org, {kind, id})`, all returning `ActionState`. Actions resolve the independently authorized project context before calling the transaction-aware service. Edits cannot move an existing log between assets/projects/allocations.

## Ownership

- Registry part owns `server/{registry-service,actions,queries}.ts` and adjacent tests.
- Log part owns other files under `server/`, except registry-owned files and a later opt-in `integration.test.ts`.
- UI part owns `ui/**`, asset route adapters, shared `app-nav.ts` and its tests, and the project layout Assets tab. It does not edit service files, schemas, generated code, or core context.
- The coordinator owns shared infrastructure, final integration, docs and verification. No agent spawns children.

## UI split

Forms live in `ui/components/asset-form.tsx`, `allocation-form.tsx`, `trip-form.tsx`, `usage-form.tsx`, `fuel-form.tsx` and `delete-asset-record.tsx`. Exact exports:

- `AssetForm({org, baseCurrency, asset?})`, where asset is `z.input<typeof assetInput>`.
- `AllocationForm({org, assetId, projects, allocation?})`, where projects are `{id,name,code}[]` and allocation is `z.input<typeof assetAllocationInput>`.
- `TripForm`, `UsageForm`, `FuelForm` accept `{org, assetId, allocations, baseCurrency, entry?}`. Allocations are `{id,projectId,project:{id,name,code},startDate:string,endDate:string|null}[]`. `entry` is the corresponding schema input. A form's allocation choice supplies projectId and allocationId. Disable identity fields on edits.
- `DeleteAssetRecord({org,id,kind})`, where kind is `ALLOCATION | TRIP | USAGE | FUEL`, uses confirmation before the corresponding delete action.

Form components serialize no Prisma values; views pass plain strings. Timestamp controls use `datetime-local` with explicit UTC labels and convert their values to ISO UTC before submission. This preserves the same calendar dates used by allocation checks and costs. The raw schema receives an ISO timestamp.

The forms agent owns these components only. The screens agent owns `ui/views/**`, table components, route adapters, app navigation and project Assets tab. Screens use the exact form exports above and the query contract. Forms are built independently of unfinished query types.
