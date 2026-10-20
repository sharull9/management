# Phase 4 shared contract — vehicles and machinery

This document is the Phase IV handoff contract for vehicle and machinery support. All asset prices and log costs are in `Organization.baseCurrency`; when posting `CostEntry`, use the Phase 3c cost-entry helper to convert into project currency.

## Schema (names are final)

- `Asset` (`assets`): `id`, `organizationId`, `type` (`VEHICLE|MACHINE`), `meterType` (`KM|HOURS`), `powerType` (`DIESEL|PETROL|ELECTRIC|OTHER`), `name`, `code`, `active`, `equipmentRatePerMeter Decimal(18,2)`, nullable `powerRatingKw Decimal(18,4)`, nullable `electricityTariff Decimal(18,2)`, optional `createdById`, timestamps. Code is unique per organization. Electric assets of either type or meter require positive kW and non-negative tariff. Other power types have null electrical specifications. Equipment rate is non-negative and expressed in base currency per KM or hour.
- `AssetAllocation` (`asset_allocations`): `organizationId`, `assetId`, `projectId`, `startDate` and optional `endDate` (inclusive dates), optional creator, timestamps. `endDate >= startDate`. An asset cannot have overlapping allocations, including across projects. PostgreSQL trigger enforces this under concurrent writes. Allocation and selected asset/project must share organization.
- `AssetTrip` (`asset_trips`): `organizationId`, `assetId`, `allocationId`, `projectId`, `outAt`, `inAt`, start/end meter reading Decimal(18,4), `equipmentRateSnapshot Decimal(18,2)`, `equipmentCost Decimal(18,2)`, optional power rating kW snapshot, tariff snapshot, kWh, and electricity cost, notes, optional creator, timestamps. Server validation requires `inAt > outAt`, readings non-negative and end >= start. Meter must be KM. Cost = (end - start) x snapshotted rate, rounded to base currency precision. Electric trips snapshot kW and tariff; elapsed hours = `inAt - outAt`, kWh = elapsed hours x kW rounded to 4 decimals, and electricity cost = unrounded elapsed hours x kW x tariff rounded to base currency precision. Non-electric trips have null electrical snapshots/cost.
- `AssetUsage` (`asset_usages`): same ownership refs, `startAt`, `endAt`, start/end reading, equipment rate snapshot/cost, optional power rating kW snapshot, tariff snapshot, kWh and electricity cost, notes, creator, timestamps. Duration must be positive; readings non-negative and end >= start. Meter must be HOURS. Equipment cost = hours x rate, rounded to base currency precision. Electric asset usage snapshots kW and tariff; kWh = duration hours x kW rounded to 4 decimals and electricity cost = unrounded duration hours x kW x tariff rounded to base currency precision. Non-electric usage has null electrical snapshots/cost.
- `AssetFuelLog` (`asset_fuel_logs`): same ownership refs, `date` (date), `quantityLitres Decimal(18,4)`, `totalCost Decimal(18,2)`, `meterReading Decimal(18,4)`, notes, creator, timestamps. Quantity is positive, cost/readings non-negative. Meter must match asset meter. `totalCost` is in base currency.

All ownership FKs are restrictive/default Prisma FKs; backend queries must scope organization and verify that allocation, asset, and project ids agree. Deleting a document removes/replaces its associated CostEntry rows in the same transaction. Logs remain editable/deletable; they are not immutable postings.

## Cost ledger mapping

For each document mutation, compute its replacement cost entries and replace them atomically in the same transaction. Use `(organizationId, sourceType, sourceId)` as the identity already enforced by CostEntry's unique key. For each row call `currency/server/cost-entry.costEntryAmounts` with the document's base-currency amount as original amount, original currency = organization base currency, and project currency/rate resolved for the cost date. Store the project amount, base amount, rates and description from that helper.

| Source type | Document / cost type | Date | Amount in base currency |
| --- | --- | --- | --- |
| `ASSET_TRIP` | AssetTrip / `EQUIPMENT` | trip out date | equipmentCost |
| `ASSET_USAGE` | AssetUsage / `EQUIPMENT` | usage start date | equipmentCost |
| `ASSET_ELECTRICITY` | AssetUsage / `ELECTRICITY` | usage start date | electricityCost |
| `ASSET_ELECTRICITY` | AssetTrip / `ELECTRICITY` | trip out date | electricityCost |
| `ASSET_FUEL` | AssetFuelLog / `FUEL` | fuel date | totalCost |

Skip the electricity entry when the trip or usage is non-electric. `ASSET_TRIP` and `ASSET_ELECTRICITY` intentionally share the trip id, as do `ASSET_USAGE` and `ASSET_ELECTRICITY` for usage; source types remain distinct and document IDs are unique. Replacing/deleting a trip or usage replaces/deletes both source types atomically. Fuel efficiency is informational only and must never create a CostEntry.

## Pure module exports

Import concrete files (no barrel):

- `@/modules/assets/constants`: `ASSET_TYPES`, `ASSET_METER_TYPES`, `ASSET_POWER_TYPES`, `ASSET_COST_SOURCE_TYPES`.
- `@/modules/assets/type`: `AssetType`, `AssetMeterType`, `AssetPowerType`, `FuelEfficiency`.
- `@/modules/assets/schema`: `assetInput`, `assetAllocationInput`, `assetTripInput`, `assetUsageInput`, `assetFuelLogInput`. Decimal-valued form fields are decimal strings; timestamps are ISO datetimes with offsets and dates are `YYYY-MM-DD`.
- `@/modules/assets/util`: `assertAssetConfiguration`, `assertDateRange`, `assertUsageInterval`, `assertNonNegativeReadings`, `calculateFuelEfficiency`, `calculateElectricity`, `calculateEquipmentCost`.

`calculateFuelEfficiency({meterType, previousReading, currentReading, quantityLitres})` uses litres on the current fill: KM returns `(current - previous) / quantityLitres` in `km/L`; HOURS returns `quantityLitres / (current - previous)` in `L/hr`. The result is labeled `estimate`, rounded to 4 decimals, and has `value: null` for the first fill or zero meter delta. Backend lookup for the previous fill must use the prior log for the same asset ordered by date, meterReading, then id; recompute affected later estimates after edits/deletes. These estimates do not claim tank-to-tank precision.

`calculateEquipmentCost(quantity, ratePerMeter, decimals = 2)` uses Decimal multiplication and half-up rounding at the base currency precision. `calculateElectricity({hours,powerRatingKw,tariff,decimals = 2})` returns `{kwh,cost}`. Stored kWh rounds to four decimals; cost uses the full unrounded product and rounds once at the base currency precision. Helpers import `Decimal` from `@/core/decimal` and never convert money to JS number.

## Backend/UI invariants

- Validate every log against the referenced asset and allocation: same organization, allocation belongs to asset and project, log date/time is within the inclusive allocation dates, asset active when creating a new entry, and meter/power combinations match the asset.
- Compare meter reading with neighboring trip/usage/fuel readings for the same asset and prevent regressions. Do not infer that readings increase only from the immediately prior fill if the log's event order is ambiguous; use date/time then id and report the conflict.
- Snapshots are copied when a log is created. Editing its times, readings or notes preserves those rate and electrical snapshots. Asset rate changes affect new logs only.
- Allocation coverage, cost dates and timestamp inputs use UTC calendar days. The forms and history explicitly label timestamp values as UTC. Trip return times must be strictly after departure, matching usage duration validation.
- Only allocation overlap is DB-enforced. Project/organization composite consistency, log range membership, matching meter modes, and reading order must be enforced by backend transactions.
- All mutations use permissions/audit patterns of the existing project-cost module and refresh project costs after commit. Keep routes thin and import concrete module files.
