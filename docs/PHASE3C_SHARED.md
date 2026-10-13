# Phase 3c shared contract — multi-currency

Wave 1 (this foundation) is merged. Wave 2 agents A–D wire their modules to it in parallel and must not edit `prisma/schema.prisma`, `src/modules/currency/util.ts` or `src/modules/currency/server/{rates,cost-entry,base-currency}.ts`; ask the integration owner for changes.

## Money model

| Term | Meaning |
| --- | --- |
| Base currency | `Organization.baseCurrency`. Always enabled for its tenant. Stock and the ledger-of-record are valued in it. |
| Document currency | `currency` on a document. Totals are stored in it. |
| Project currency | `Project.currency`. `CostEntry.amount` and budgets are in it. |
| `exchangeRate` | Base units per 1 unit of the document (or original) currency. Exactly `1` when the currency is the base currency. |
| `projectRate` | Base units per 1 unit of the project currency (CostEntry only). |

Rates come from `ExchangeRate` (per organization, one per currency per `rateDate`): latest on or before the document date. Users may override the rate per document; the override is stored on the document and the dated table is not touched.

## Schema (names are final)

- `Currency` (`currencies`): `code` PK (ISO 4217), `name`, `symbol`, `decimals` 0–4, `active`.
- `TenantCurrency`: `tenantId`, `currencyCode`, `enabled`; unique `(tenantId, currencyCode)`.
- `ExchangeRate`: `organizationId`, `currencyCode`, `rateDate` (date), `rate` Decimal(20,10), `createdById`; unique `(organizationId, currencyCode, rateDate)`.
- FKs to `Currency.code`: `Organization.baseCurrency`, `Project.currency`, `Party.defaultCurrency` (nullable), and `currency` on PurchaseOrder, GoodsReceipt, VendorBill, PaymentRequest, Payment, SalesInvoice, Expense; `CostEntry.originalCurrency`. Relation fields are named `<field>Ref` (`currencyRef`, `baseCurrencyRef`, `defaultCurrencyRef`, `originalCurrencyRef`).
- `exchangeRate Decimal(20,10) @default(1)` on PurchaseOrder, GoodsReceipt, VendorBill, PaymentRequest, Payment, SalesInvoice, Expense.
- Base totals (Decimal(18,2), `@default(0)`, same rounding as the original):

| Model | Original → base field |
| --- | --- |
| PurchaseOrder | `subtotal`→`baseSubtotal`, `taxTotal`→`baseTaxTotal`, `withholdingTotal`→`baseWithholdingTotal`, `grandTotal`→`baseGrandTotal` |
| VendorBill, SalesInvoice | `subtotal`, `discountTotal`, `taxTotal`, `withholdingTotal`, `grandTotal`, `payableTotal` → `base<Field>` |
| PaymentRequest, Payment, Expense | `amount`→`baseAmount` |
| GoodsReceipt | `currency` + `exchangeRate` only (no money totals); inherits the PO's |

Lines, line taxes, `paidTotal`/`receivedTotal`, `allocatedAmount`, `unallocatedAmount`, balances and tolerances stay in the document currency.
- `PaymentAllocation`: `amount` (document currency, unchanged), `baseAmount`, `documentBaseAmount`, `fxDifference`.
- `CostEntry`: `amount` (project currency, unchanged meaning), `originalCurrency`, `originalAmount`, `exchangeRate`, `baseAmount`, `projectRate`.
- `StockMovement.unitCost`/`totalCost` are BASE currency. Stock balances and moving averages are base.

## Conventions

**Rounding**: half away from zero (`Decimal.ROUND_HALF_UP`), at the target currency's `decimals`. Convert once per stored total (`toBase(total, rate, baseDecimals)`); never sum rounded line conversions into a base total. Rates are stored with 10 decimals.

**Cost entries**: if `originalCurrency == project currency` then `amount = originalAmount` exactly (and `projectRate = exchangeRate`); otherwise `amount = round(baseAmount / projectRate, projectDecimals)`. `baseAmount = round(originalAmount × exchangeRate, baseDecimals)`. Signs follow the existing rule (negative only for MATERIAL `TRANSFER`/`BILL_VARIANCE`); the DB check requires all of `amount`, `originalAmount`, `baseAmount` to be ≥ 0, or all ≤ 0 for those sources.

**Realised FX** (Phase 5 input): `fxDifference = baseAmount − documentBaseAmount`, stored as that single signed number for both sides.
- Payables (`OUTGOING` payment against a vendor bill): positive = more base currency paid than the bill carried = **loss**.
- Receivables (`INCOMING` receipt against a sales invoice): positive = more base currency received than invoiced = **gain**.
`realisedFx(...)` returns `outcome` (`GAIN`/`LOSS`/`NONE`) applying this.

**Allocation** is only between the same currency: call `assertSameCurrency(payment.currency, document.currency)`; there is no cross-currency allocation. `baseAmount` uses the payment's `exchangeRate`, `documentBaseAmount` the allocated document's.

**Drafts** may carry a provisional rate; re-resolve (or keep the user override) when submitting. A document's rate is frozen once it leaves draft.

**Base currency lock**: `Organization.baseCurrency` cannot change once the organization has any CostEntry, StockMovement, non-draft PO/GRN/bill/payment request/sales invoice, any payment or expense, or any exchange rate (`assertBaseCurrencyChangeAllowed`).

## Helpers (import the concrete file)

`@/modules/currency/util` (pure, no DB):

```ts
roundMoney(value, decimals): Decimal
assertPositiveRate(rate, label?): Decimal
toBase(amount, rate, baseDecimals): Decimal
fromBase(baseAmount, rate, decimals): Decimal
costAmounts({ originalCurrency, originalAmount, exchangeRate, baseCurrency, baseDecimals,
              projectCurrency, projectDecimals, projectRate }): { originalAmount, baseAmount, amount }
realisedFx({ amount, paymentRate, documentRate, baseDecimals, direction: "OUTGOING"|"INCOMING" })
  : { baseAmount, documentBaseAmount, fxDifference, outcome }
assertSameCurrency(paymentCurrency, documentCurrency, context?): void
```

`@/modules/currency/server/rates` (take a Prisma transaction client):

```ts
organizationBaseCurrency(tx, organizationId): { code, decimals }
resolveRate(tx, organizationId, currencyCode, date): Decimal        // 1 for base; throws "No USD exchange rate on or before 2026-10-13. Add one in Settings → Exchange rates."
resolveProjectRate(tx, organizationId, projectId, date): Decimal
resolveDocumentFx(tx, { organizationId, currency, date, override? })
  : { exchangeRate, baseCurrency, baseDecimals, toBase(amount) }    // use for every document's rate + base totals
```

`@/modules/currency/server/cost-entry`:

```ts
costEntryAmounts(tx, { organizationId, projectId, date, currency?, amount, exchangeRate? })
  : { amount, originalCurrency, originalAmount, exchangeRate, baseAmount, projectRate }
```

Spread the result into every `costEntry.create`/`upsert` data. `currency` defaults to the organization base currency; `exchangeRate` defaults to the dated lookup (an explicit rate is the document's stored rate).

`@/modules/currency/server/queries`: `listCurrencies()`, `listTenantCurrencies(tenantId)`, `listEnabledCurrencies(tenantId, baseCurrency?)`, `listExchangeRates(organizationId, currencyCode?)`.
`@/modules/currency/server/picker-actions`: `findCurrencies(org, query): Option[]` — tenant-enabled currencies; any organization member.
`@/modules/currency/server/actions`: `setTenantCurrencyAction(org, { currencyCode, enabled })`, `setBaseCurrencyAction(org, { currencyCode })`, `saveExchangeRateAction(org, { id?, currencyCode, rateDate, rate })`, `deleteExchangeRateAction(org, { id })`. Schemas in `@/modules/currency/schema`.

Permissions: `currency.manage` (tenant currencies, base currency, Currencies page) and `exchangeRate.manage` (rates, Exchange rates page). Routes: `/[org]/settings/currencies`, `/[org]/settings/exchange-rates` (placeholder views in `currency/ui/views/`).

## Wave 1 behaviour of existing writers

All six CostEntry writers go through `costEntryAmounts`. Stock-derived postings (GRN, consumption, transfer) use the base currency at rate 1 because stock is base-valued. Attendance passes the project currency (labour rates are project-currency). Expense approval uses the expense's `currency`/`exchangeRate`; bill-variance posting uses the bill's. With single-currency data every `amount` is unchanged and `originalAmount = baseAmount = amount`.

Known gap until wave 2: for a project whose currency differs from the base currency, base-valued postings need a project-currency rate and throw the "No … exchange rate" error until one exists in Settings → Exchange rates.

## Wave 2 ownership

| Agent | Owns |
| --- | --- |
| **A** | Currency/settings UI (`currency/ui/**`, replaces placeholders; organization form base-currency field uses `setBaseCurrencyAction`), party default currency (`masters`), project currency field (`project`) with a tenant-enabled currency picker via `findCurrencies`. |
| **B** | `procurement` PO/GRN (currency, rate override, base totals; GRN inherits PO) and `vendor-bill` (currency from PO, rate, base totals, variance in bill currency). |
| **C** | `payment` (requests, payments, allocation same-currency rule, `baseAmount`/`documentBaseAmount`/`fxDifference`, balances per currency + base total) and `sales-invoice`. |
| **D** | `attendance`, `project-cost` expenses/views, `project` budget and `dashboard` (aggregate `CostEntry.amount` per project currency, show base totals via `baseAmount`). |

## Rules for wave 2

1. Never write money fields without the matching base field and `exchangeRate`; compute them with `resolveDocumentFx` in the same transaction as the document.
2. Do not change what `CostEntry.amount` means. Budget/dashboard queries keep summing `amount` per project currency; use `baseAmount` for cross-project totals.
3. Never sum amounts of different currencies; group by currency and show a base-currency total from base fields.
4. Only enabled tenant currencies may be chosen on documents (validate with `TenantCurrency`); the base currency is always allowed.
5. Rate overrides must be positive; show the resolved rate and its source date to the user and keep the Phase 3b approval/numbering/audit flows intact.
6. Import concrete files (no barrels). Keep pure logic in `util.ts` with adjacent tests; `pnpm check:boundaries` applies.
7. Do not add migrations that touch the currency tables; additive migrations for your own models need a timestamp after `20261013100000_phase3c_currency`.

## Agent A — currency settings UI (wave 2)

- **Currencies** (`/settings/currencies`): table of the tenant's chosen currencies with enable/disable and a Base badge; add from the master via `AddCurrencyForm`. Read needs `currency.manage` or `settings.manage`; changes need `currency.manage`. New query `listCurrencySettings(tenantId)`.
- **Exchange rates** (`/settings/exchange-rates`): `?currency=&from=&to=` filters, latest-rate summary, add/edit/delete. Same read/manage split with `exchangeRate.manage`. `listExchangeRates(orgId, filters | currencyCode)` now also returns `createdByName`; new `latestExchangeRates(orgId)`. `currency/rate-format.ts` holds `formatRate`/`describeRate` ("1 USD = 83.5000000000 INR").
- **Party default currency**: `defaultCurrency` on the master party input; validated against enabled tenant currencies in `party-service.ts`. Not yet applied to documents — agents B/C may pre-select `party.defaultCurrency` on new PO/bill/invoice forms.
- **Project currency**: picked from `findCurrencies`; `saveProject` rejects a currency that is not enabled and blocks a change once the project has any `CostEntry` (`project/currency-guard.ts`).
- **Organization form**: base currency is a Combobox over the active master (`currencies` prop, required on `OrganizationForm`); the wave-1 guard message is shown by the form shell.
