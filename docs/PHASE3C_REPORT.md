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
