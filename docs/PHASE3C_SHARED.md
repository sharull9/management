# Phase 3c shared contract — multi-currency

Waves 1–2 and integration are merged; see [PHASE3C_REPORT.md](PHASE3C_REPORT.md). During wave 2, agents A–D wired their modules in parallel and did not edit `prisma/schema.prisma`, `src/modules/currency/util.ts` or `src/modules/currency/server/{rates,cost-entry,base-currency}.ts`; ask the integration owner for changes.

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

`resolveRateWithDate(tx, organizationId, currencyCode, date): { rate, rateDate }` is the same lookup with the source row's date (`null` for the base currency); `resolveRate` wraps it.

`@/modules/currency/server/enabled`: `assertEnabledCurrency(tx, tenantId, code, baseCurrency?)` is the one tenant-enabled (and active) currency check, used by documents, expenses, projects and party defaults. Pass the organization's base currency to skip the lookup for it.

`@/modules/currency/server/fx-actions`: `previewExchangeRate(org, { currency, date }): { baseCurrency, exchangeRate, rateDate, error }`, the single server function that prefills the rate on every form (organization-scoped, Zod-validated; a missing rate is `error`, not a throw).

`@/modules/currency/ui/components/currency-fx-fields`: `CurrencyFxFields` (currency combobox + rate) and `ExchangeRateField` (rate only), used by PO, GRN, vendor bill, payment request, payment, sales invoice and expense forms. Render inside a react-hook-form `FormProvider` with `currency`, `exchangeRate` and the date field (`dateName`, default `date`).

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

## Agent D (attendance, expenses, project costs, budget, dashboard)

- Expense form: `currency` (tenant-enabled via `findCurrencies`, default project currency) and `exchangeRate` (blank resolves the dated rate server-side; prefilled by the shared `previewExchangeRate`, fixed 1 and disabled for the base currency). Expense `baseAmount` = `toBase` of the total once; the amount's precision must fit the currency's decimals.
- Approval requests for expenses carry `baseAmount` as `amount`, so policy thresholds are in the organization base currency.
- Cost ledger shows original (amount + code) and project-currency amount; expenses list shows original, project amount (once posted, or same-currency) and base amount.
- Attendance resolves the project-currency rate once before writing; a missing rate fails with "Cannot record attendance costs for <date>. No <CUR> exchange rate ...". Worker pay has no currency field: salary and overrides are treated as project currency.
- Project pages show project currency; the overview Spent tile adds the base-currency total (`projectSpentBase`) when the project currency differs from base. Org dashboard "Spent this month" sums `baseAmount` in base currency (`dashboard/util.summariseSpend`) with the project-currency breakdown in the detail line; per-project rows stay in project currency.
- `project-cost-policy` is pure and value-agnostic; unchanged.

## Agent B — procurement and vendor bills

- **PO**: `currency` (tenant-enabled; default = vendor `defaultCurrency`, else base) + `exchangeRate` (user-confirmed or the dated rate for the PO date via `resolveDocumentFx`, must be > 0, exactly 1 for base). `base*` totals are computed server-side from the document totals, each converted once. PO currency is no longer tied to the project currency. Approval thresholds use `baseGrandTotal` (PO and vendor bill).
- **GRN**: inherits the PO currency; carries its own `exchangeRate` (dated rate for the receipt date, editable). `StockMovement.totalCost = round(acceptedQty × PO netRate × GRN rate, baseDecimals)`, `unitCost = totalCost / stockQty` (8 dp) — `stock-valuation/util.receiptValuation`. ON_RECEIPT `CostEntry`: `originalCurrency` = GRN currency, `originalAmount = acceptedQty × netRate`, `exchangeRate` = GRN rate, `baseAmount` = the stock movement value, `amount` = project currency via `projectRate`. Recognition (ON_RECEIPT vs ON_CONSUMPTION) is still decided by `materialCostEffects`.
- **Consumption / transfer**: stock is base-valued; their `CostEntry` rows use base as the original currency. The same-currency transfer restriction was removed: the source loses `V` base and the destination gains `V` base, each converted into its own project currency.
- **Vendor bill**: `currency` must equal its PO's (and any linked GRN's); otherwise vendor default, else base. `exchangeRate` prefilled for the bill date, editable. Tax is calculated in the document currency, then `base{Subtotal,DiscountTotal,TaxTotal,WithholdingTotal,GrandTotal,PayableTotal}` are each converted once.
- **`VendorBillLine.varianceAmount` is now BASE currency**: `round(qty × billNetRate × billRate) − round(qty × poNetRate × receiptRate)`, where `receiptRate` is the linked GRN's rate, else the accepted-qty weighted rate of the PO line's approved receipts, else the PO's rate. It therefore includes FX between receipt and bill (USD PO at 83, received at 84, billed at 85 and same price: +1,000 per 10 × 100 USD). The `BILL_VARIANCE` CostEntry sums these and is posted with the base currency as its original currency at rate 1.
- Picker helpers: `procurement/server/rate-actions` (`vendorDefaultCurrency`, `purchaseOrderCurrency`). Rate prefill and the currency check were consolidated into `currency/server/fx-actions` and `currency/server/enabled` during integration.

## Agent C: payment and sales-invoice (wave 2)

- **Documents**: payment requests, payments and sales invoices carry `currency` (any tenant-enabled currency, validated server-side via `TenantCurrency`; omitted = base) and `exchangeRate`. The rate is the user override or the dated lookup (`resolveDocumentFx`); the base currency is always 1. `base<Field>` totals are converted once per total. Forms use the shared `currency/ui/components/currency-fx-fields.tsx`, which prefills the rate with `currency/server/fx-actions.previewExchangeRate` on currency/date change. Default currency is the party's `defaultCurrency`, else base.
- **Drafts**: the stored rate (override or the value resolved at save) is kept on submit; it is frozen once the document leaves draft. Approval requests carry the **base** amount (`baseAmount`/`baseGrandTotal`) so thresholds compare in one currency.
- **Allocation**: `target()` calls `assertSameCurrency`; the open-document picker already filters by currency. Per allocation: `baseAmount = toBase(amount, payment.exchangeRate)`, `documentBaseAmount = toBase(amount, document.exchangeRate)`, `fxDifference = baseAmount − documentBaseAmount` (`allocationFx` wraps `realisedFx`). Positive = loss for OUTGOING/vendor bills, gain for INCOMING/sales invoices. An advance allocated later uses the advance payment's own rate.
- **Void**: allocation rows are kept as the trail; realised FX is summed over allocations of `POSTED` payments only (`activeFxTotal`), so voiding reverses FX exactly as amounts.
- **Sales stock**: `SALE_OUT` stays base-valued (moving average); the old "project currency must equal invoice currency" check was removed.
- **Reports**: balances/aging stay per party and document currency, plus base columns (outstanding at each document's rate) and base tiles; statements are per party and currency (default: party default currency if it has activity, else the only/first currency) with a base running balance.

## Approval threshold convention

`submitForApproval({ amount })` always receives the **base-currency** amount, so policy `minAmount` steps compare one currency across documents and the approvals inbox formats `ApprovalRequest.amount` in the organization base currency.

| Document | Amount passed |
| --- | --- |
| Purchase request | `estimatedTotal` (requests carry no currency; estimates are base) |
| Purchase order | `baseGrandTotal` |
| Goods receipt | none (no money total) |
| Stock transfer | none (value is set at approval from base stock cost) |
| Vendor bill | `baseGrandTotal` |
| Payment request | `baseAmount` |
| Sales invoice | `baseGrandTotal` |
| Expense | `baseAmount` |
| Task submission / delay | none |
| Payment | not approved |

The approval policy form labels the threshold "Minimum amount in base currency". Never pass a document-currency total.
