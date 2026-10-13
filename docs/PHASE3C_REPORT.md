# Phase 3c report — multi-currency

Contract and per-agent notes: [PHASE3C_SHARED.md](PHASE3C_SHARED.md). This report records the final design, formulas, decisions and what was verified.

## Design

- **Base currency** per organization; stock and ledger-of-record values are base. **Document currency** on PO, GRN, vendor bill, payment request, payment, sales invoice and expense (tenant-enabled currencies only). **Project currency** is what `CostEntry.amount` and budgets use.
- `exchangeRate` = base units per 1 unit of the document currency; exactly 1 for the base currency. Dated manual rates live in `ExchangeRate`; the document uses the latest rate on or before its date, or a positive user override stored on the document. A missing rate is a validation error pointing to Settings → Exchange rates.
- Currency module (`src/modules/currency`) owns the master, tenant currencies, rates, base-currency lock, `costEntryAmounts`, `previewExchangeRate` (one server function for every form), `assertEnabledCurrency` (one tenant-enabled check) and the shared `CurrencyFxFields`/`ExchangeRateField` form components.

## Formulas and rounding

| Quantity | Formula |
| --- | --- |
| Base total | `round(total × rate, baseDecimals)`, converted once per stored total, never a sum of rounded lines |
| Cost `baseAmount` | `round(originalAmount × exchangeRate, baseDecimals)` |
| Cost `amount` (project currency) | `originalAmount` when original = project currency, else `round(baseAmount / projectRate, projectDecimals)` |
| GRN stock value | `round(acceptedQty × PO netRate × GRN rate, baseDecimals)`; `unitCost = totalCost / stockQty` (8 dp) |
| Bill line variance (base) | `round(qty × billNetRate × billRate) − round(qty × poNetRate × receiptRate)` |
| Allocation FX | `baseAmount = toBase(amount, payment rate)`, `documentBaseAmount = toBase(amount, document rate)`, `fxDifference = baseAmount − documentBaseAmount` |

Rounding is half away from zero (`Decimal.ROUND_HALF_UP`), so negative amounts mirror positive ones.

## Sign conventions

- `CostEntry`: `amount`, `originalAmount` and `baseAmount` share a sign; negative only for MATERIAL `TRANSFER` (source side) and `BILL_VARIANCE` (the DB check from migration `20261013100000_phase3c_currency`).
- `fxDifference` is one signed number. Payables (OUTGOING payment vs vendor bill): positive = loss. Receivables (INCOMING receipt vs sales invoice): positive = gain. `realisedFx().outcome` applies this.

## Decisions

- **Approval thresholds are base-currency.** Every `submitForApproval` passes a base amount (table in PHASE3C_SHARED.md); the policy form labels the threshold "Minimum amount in base currency" and the inbox formats amounts in the base currency. Purchase requests have no currency; their estimates are base.
- **BILL_VARIANCE is posted in base at rate 1** (`originalCurrency` = base). Line variances already include receipt-to-bill FX. For a project whose currency differs from base, `costEntryAmounts` converts the base variance to the project currency with the project rate dated at the bill date (negative variances keep their sign); a missing project-currency rate fails the approval with the "No … exchange rate" message.
- **GRN stock value rounds to base decimals**; each receipt carries its own editable rate (default: dated rate for the receipt date).
- **Currency lock rules**: the PO fixes the bill currency; GRN inherits the PO currency; project currency cannot change once the project has any cost entry; the organization base currency cannot change once it has cost entries, stock movements, non-draft PO/GRN/bill/request/invoice, any payment or expense, or any exchange rate; a currency in use as a base, project or party default cannot be disabled for the tenant.
- **Allocation is same-currency only**; payment requests must match their bills' currency. Voiding keeps allocation rows and excludes voided payments from realised FX (`activeFxTotal`).
- **Rate frozen outside draft**; drafts may carry a provisional or overridden rate.
- **Server never trusts client base amounts**: no input schema accepts base fields; base totals are recomputed from document totals and the validated rate in the same transaction.
- **Currencies with more than two minor-unit digits are not enabled yet** (BHD, IQD, JOD, KWD, OMR, TND). Money columns are `Decimal(18,2)` and cannot hold the third digit, so enabling them (tenant, base, rates, organization form) is rejected with a clear message. 0-decimal currencies (JPY, KRW, …) work as base and as foreign currencies; base totals round to 0 decimals.

## Integration consolidation

- `resolveRateWithDate` (rate + source date) in `currency/server/rates`; `resolveRate` wraps it.
- `currency/server/fx-actions.previewExchangeRate` replaced procurement `suggestExchangeRate`, payment `previewDocumentFx` and project-cost `expenseFx`.
- `currency/server/enabled.assertEnabledCurrency` replaced procurement `assertDocumentCurrency`, payment `assertCurrencyEnabled`, project `assertProjectCurrencyEnabled` and the inline checks in expenses, party defaults and exchange rates. The check now always requires `active` currency rows (previously PO/bill/expense did not); the message is "<CODE> is not an enabled currency for this tenant."
- `currency/ui/components/currency-fx-fields` is used by PO, GRN, bill, request, payment, invoice and expense forms. The procurement form value for `exchangeRate` is now a string (was number); the service input is unchanged.

## Verified

- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm check:boundaries`, `pnpm prisma validate`, `pnpm build` (placeholder `DATABASE_URL`): pass.
- `pnpm test`: 189 tests, 188 pass, 1 skipped (the opt-in Postgres test), 0 fail. New tests cover `resolveRateWithDate`, a negative base variance into a USD project, a 0-decimal base with a 3-decimal project, and the storable-currency guard.
- Opt-in settlement test (`PAYMENTS_DB_TEST=local-only`, fresh `prisma dev` database with all migrations deployed and the base seed): pass.
- `pnpm db:seed:demo --reset` completes against the migrated database (the local, gitignored script needed `currency`/`exchangeRate` on the expense input).

## Not verified / open

- Browser behaviour of the shared currency/rate fields and the new FormProvider wrappers (separate verification wave).
- Document-currency totals are stored to two decimals (column scale); a JPY document can carry fractional yen in its own currency. Base totals are rounded to base decimals. Rounding documents at their currency's decimals, and widening columns for 3-decimal currencies, are follow-ups.
- Payment/allocation inputs accept at most two decimals regardless of currency.
- `vendorDefaultCurrency` (procurement) and `partyDefaultCurrency` (payment) are near-duplicates; left in their modules.
- Realised FX is stored but not posted anywhere yet (Phase 5).
- `docs/PHASE3B_COST_RECOGNITION.md` is CRLF and some older migration/doc files have mixed line endings; no `.gitattributes` was added because renormalising would rewrite an applied migration.

## Runtime verification

Browser (Playwright) plus DB checks against a local `prisma dev` database and the dev server, owner/PM/accountant demo logins. D1 = 2026-10-05, D2 = 2026-10-08, D3 = 2026-10-12, today 2026-10-13. Base INR, project P-USD in USD (ON_RECEIPT).

| Step | Result | Numbers |
| --- | --- | --- |
| 1 Currencies and rates | Pass | USD and EUR enabled; adding KWD is rejected ("KWD uses 3 decimal places; amounts are stored to 2 decimals, so it is not supported yet."). Rates USD 83 (D1), USD 85 (D3), EUR 90 (D1); latest-rate summary shows `1 USD = 85.0000000000 INR, as of 2026-10-12`. Changing the base currency to EUR is blocked ("... 159 cost entries, 17 stock movements, 40 non-draft financial documents, 3 exchange rates ..."). |
| 2 Parties and project | Pass | Vendor and customer default USD. P-USD currency USD; changing it to EUR is rejected once it has 3 cost entries. |
| 3 PO | Pass | Defaults USD / 83 (editable). 10 x 100 USD = 1,000 USD, base 83,000. Submitted and approved. |
| 4 GRN | Pass | Rate override 84 at D2. Stock movement 84,000 INR (unit cost 8,400). ON_RECEIPT cost: original USD 1,000, rate 84, base 84,000, project amount 1,000.00, project rate 84. Because the original currency is the project currency, `amount` equals `originalAmount` exactly; the "base / D2 USD rate" figure (84,000 / 83 = 1,012.05) applies only to non-USD originals. |
| 5 Bill | Pass | D3, 10 x 100 USD at 85: base grand total and payable 85,000. Line variance +1,000 INR; BILL_VARIANCE cost original 1,000 INR, base 1,000, project amount 11.76 USD (1,000 / 85). Approved by PM then accounts. |
| 6 Payments | Pass | USD 1,000 at 85 allocated to the bill: fxDifference 0.00 (base 85,000 vs 85,000). A second USD bill at 83 (base 83,000) paid at 85: base 85,000, documentBaseAmount 83,000, fxDifference +2,000 shown as "Loss INR 2000.00". Voiding the payment shows "FX reversed", Realised FX None and the bill balance returns to USD 1,000 (party net -1,000 USD, base -83,000). The allocation picker offers only same-currency documents; an INR/JPY payment lists no USD bill. The server-side same-currency check is unit tested (`assertSameCurrency`). |
| 7 EUR expense | Pass | EUR 100 at 90 on the USD project: base 9,000, project amount 105.88 (9,000 / 85), project rate 85. Cost ledger shows original EUR 100.00 and project amount USD 105.88. Overview: Spent USD 1,117.64 and INR 94,000 in base (84,000 + 1,000 + 9,000). Budget page is in USD. The organization dashboard sums base INR and lists P-USD in USD. |
| 8 Sales | Pass | USD invoice 4 x 150 + 5% tax = 630 USD, base 53,550 at 85. SALE_OUT is -4 at unit cost 8,400 = -33,600 INR (moving average, base). USD receipt 630 at 87: base 54,810, documentBaseAmount 53,550, fxDifference +1,260 shown as "Gain INR 1260.00"; invoice PAID. |
| 9 Balances and statements | Pass | Balances show each party in its own currency with base columns (Dollar Supplies: payable USD 1,000, net base -83,000). Statements are per currency with a base running balance; the currency selector lists only currencies with activity (USD for both test parties, so switching currencies was not exercised). Aging shows base open amount with document-currency buckets. |
| 10 Approval threshold | Pass | PO policy step "Owner approval above 2,00,000" (base). PO-0005 (USD 1,000 = 83,000 INR) has only the PM step. PO-0006 (30 x 100 USD = 3,000 USD = 249,000 INR) gets the owner step although 3,000 < 200,000 numerically. The request amount is 249,000.00. |
| 11 Regression | Pass | 19 INR and USD pages (dashboard, projects, materials, attendance, stock, consumption, transfers, requests, POs, GRNs, bills, payments, payment requests, balances, invoices, receipts, parties, policies, approvals) return 200 without error pages. No dev log errors after the run apart from the database outage below. |

### Bugs fixed

- Nested `<a>` hydration error on the vendor bill, payment and payment request lists: `DataTable` already links the first cell, and the cell rendered its own `Link` (introduced in 82184fd). Fixed in 054caa8.
- 0-decimal currencies: document-currency totals (PO, bill, invoice) and payment, request and allocation amounts now round to the currency's decimals server-side, and base totals convert from the rounded values (652ef63). Runtime: a JPY payment of 1000.50 at 0.55 stores 1,001 JPY, base 550.55 INR. Expenses already rejected excess precision.
- README documents the optional `DATABASE_POOL_MAX` for local `prisma dev`.

### Notes and not verified

- During the run the `prisma dev` instance stopped accepting connections ("ConnectionClosed" in the app); it was stopped and started again with the same data directory and ports, nothing was lost.
- Statement currency switching, a party with activity in more than one currency, and EUR/JPY documents beyond the JPY payment were not exercised in the browser. JPY rounding of PO, bill and invoice totals is covered by unit tests only.
- Server-side rejection of an INR payment allocated to a USD bill was not triggered from the UI because the picker never offers it.
- Aging buckets for foreign-currency documents are in the document currency while the "Open (base)" column is base; this is labelled but easy to misread.
- Per-line amounts (line subtotal, tax, total) still use two decimals for 0-decimal currencies; only stored totals are rounded.
