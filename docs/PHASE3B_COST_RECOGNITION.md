# Phase 3b per-project material cost recognition

Agent A, wave 2, on `build/foundation`. Only owned files changed. No push.

## Posting rules

The project setting defaults to `ON_CONSUMPTION`. All posting paths read it with
`getProjectCostRecognition(tx, projectId)` after acquiring the project stock lock.
The deprecated global constant was removed from application code.

- Approved GRN: `ON_RECEIPT` posts MATERIAL cost for accepted stock value, using
  the same discounted net unit cost and value as GRN_IN, excluding purchase taxes.
  Rejected stock posts neither movement nor cost. `ON_CONSUMPTION` posts no cost.
  Cost source is GRN, keyed by the receipt line ID.
- Consumption: always withdraws stock at moving average. `ON_CONSUMPTION` posts
  MATERIAL cost per consumption line; `ON_RECEIPT` posts no additional cost.
  Line history displays stock value, which is distinct from recognition.
- Approved transfer: stock quantities and values remain equal and opposite,
  valued at the source moving average. For positive transferred value V:

| Source mode | Destination mode | Source MATERIAL cost | Destination MATERIAL cost |
| --- | --- | --- | --- |
| ON_RECEIPT | ON_RECEIPT | -V | +V |
| ON_RECEIPT | ON_CONSUMPTION | -V | None |
| ON_CONSUMPTION | ON_RECEIPT | None | +V |
| ON_CONSUMPTION | ON_CONSUMPTION | None | None |

Cost amounts round half up to two decimal places, while stock retains existing
valuation precision. Transfer costs use sourceType TRANSFER and the respective
stock movement IDs as sourceId, avoiding collisions in the existing unique key
(organizationId, sourceType, sourceId). sourceId is polymorphic, with no FK.
Existing document locks, pending-approval guards and movement source uniqueness
prevent repeated posting. All stock, cost and audit writes remain transactional.

## Settings and UI

Project create/edit includes recognition selection. A dedicated server action and
settings form also support users with project.settings.manage without granting
permission to edit unrelated project fields. Existing project.edit/project.manage
roles (including project managers) and admin bypass are accepted.

Mode changes acquire the same stock lock as posting, reload the current value,
and require the explicit checkbox when any stock movement exists. On-hand stock
comes from movements, so the movement-history check also covers positive stock
and depleted stock. Unchanged modes need no confirmation. The server enforces
confirmation even if a transaction added stock after the form was rendered.

The warning states that changes affect future transactions only and past costs
are not restated. No revaluation or historical ledger adjustment is performed.
Audit entries include oldValue, newValue and futureTransactionsOnly. Overview
and Materials display the current setting in a small badge with a focusable
explanation tooltip. Existing runtime data remains inside Suspense.

## Required shared migration before integration

The existing migration `20261010160500_phase2_integrity` adds
`cost_entry_amount CHECK (amount >= 0)`. This prevents the required negative
ON_RECEIPT source-transfer entries. **Source ON_RECEIPT transfers will fail and
roll back until a shared migration changes this constraint.** No owned-file
workaround can represent a negative CostEntry while preserving this constraint.

The shared owner should add a NEW migration that replaces the check, allowing
negative MATERIAL entries from TRANSFER (and BILL_VARIANCE if the bill agent
requires signed variance), while preserving nonnegative checks for other costs.
Do not modify the old migration. For this task alone the replacement can be:

```sql
ALTER TABLE cost_entries DROP CONSTRAINT cost_entry_amount;
ALTER TABLE cost_entries ADD CONSTRAINT cost_entry_amount CHECK (
  amount >= 0 OR ("costType" = 'MATERIAL' AND "sourceType" = 'TRANSFER')
);
```

No Prisma schema or unique-key change is required. No shared file was edited.

## Validation

- `node --import tsx --test src/server/procurement/cost-recognition.test.ts`:
  PASS, 8 tests. Both GRN/consumption modes, all four transfer combinations,
  half-up rounding, zero values, invalid values/missing destination mode, and
  changed/unchanged/confirmed settings with and without stock history.
- `pnpm test`: PASS, 17 existing tests.
- `pnpm exec biome check --write <owned TypeScript files>`: PASS, 9 files.
- `pnpm exec tsc --noEmit`: no errors in owned files; initial run reports an
  in-progress foreign-file error at src/server/payments/allocation.ts:4 (TS2749,
  Prisma.Decimal used as a type). Final recheck reports the same foreign error.
- Owned-path `git diff --check`: PASS. A repo-wide check also saw trailing whitespace
  in another agent's in-progress src/server/bills/approval.ts; that file was untouched.
- No build, Prisma generation/migration, repo-wide formatting or browser smoke
  was run, per parallel-work rules. Transaction DB smoke deferred until the
  shared cost check permits negative transfers.

## Files

- src/server/procurement/approvals.ts
- src/server/procurement/calculations.ts
- src/server/procurement/cost-recognition.ts
- src/server/procurement/cost-recognition.test.ts
- src/server/inventory/service.ts
- src/server/projects/actions.ts (saveProjectAction and new setting action)
- src/components/project-forms.tsx
- src/components/inventory-pages.tsx
- src/app/(app)/[org]/projects/[projectId]/page.tsx
- docs/PHASE3B_COST_RECOGNITION.md
