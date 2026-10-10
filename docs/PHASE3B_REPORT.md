# Phase 3b integration report

Verified on 2026-10-11 on `build/foundation`, using Windows, Node 24.18.0 and pnpm 11.22.0. Phase 3b and the module refactor are complete. Phase 3c is planned only.

## Deliverables

- Vendor bills against PO/received quantities, tax and withholding snapshots, approval, attachments, and signed net price-variance costs.
- Approved payment requests, cash/bank payments, partial settlements, advances allocated later, void/reversal, party balances, aging and statements.
- Customer invoices, goods/services and project billing, approval, stock sales and incoming settlements.
- Per-project ON_RECEIPT or ON_CONSUMPTION material recognition, transfer cost effects, and explicit confirmation for future-only setting changes when stock history exists.
- Migration `20261010203000_signed_material_cost` permits negative CostEntry amounts only for MATERIAL + TRANSFER or BILL_VARIANCE. Other negative amounts remain blocked.
- Final feature modules under `src/modules`, shared infrastructure under `src/core`, thin routes, adjacent tests, public indexes, eager approval registration without import cycles, and no R2 shims or `src/server` files.
- `pnpm check:boundaries` normalizes aliased paths before checking ownership. Its regression assertion rejects an alias containing `../` that enters another module's internals.
- `pnpm smoke:phase3b` runs real module services with a real Better Auth HTTP session and verifies the approvals inbox/history and document rendering.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the verified module responsibilities, public exports and ownership rules. Earlier feature-agent reports describe implementation details at their original paths; this report and the architecture map describe the integrated tree.

## Database and smoke execution

Applied the signed-cost migration to the existing local `management-phase3b-shared` database. Also created an isolated `management-phase3b-final` Prisma Postgres instance, applied all nine migrations with `pnpm prisma migrate deploy`, and ran `pnpm db:seed`. Environment variables were set only in the shell. `.env` was not changed.

The successful final run used `management-phase3b-final` at localhost TCP port 51257, with a normal `pnpm dev` on `http://localhost:3000`. Required smoke environment variables are documented in [README.md](../README.md). Fixtures are retained under organization `phase3b-1791658802509` for inspection. The app dev server and the new local database server were stopped after verification.

Observed values below are asserted against database rows and module query results, rather than inferred from console messages:

- Both POs received 10 of 20 units. P1 ON_RECEIPT cost was 1000.00; P2 ON_CONSUMPTION cost was 0.00.
- Consumption of 2 units in each project added 0.00 to P1 costs and 200.00 to P2 costs.
- Transfer of 3 units from P1 to P2 posted -300.00 to P1 costs and 0.00 to P2 costs. P1 cost became 700.00. The unconfirmed recognition switch was rejected; the confirmed validation returned the previous ON_RECEIPT mode. The smoke does not persist that switch.
- Vendor bill base 900.00 + GST 162.00 = grand total 1062.00; TDS 9.00 reduced payable to 1053.00. Approval posted MATERIAL / BILL_VARIANCE of -100.00.
- CASH without an approved payment request was rejected. An approved request/payment of 400.00 made the bill PARTIALLY_PAID. A 653.00 advance allocated later made it PAID. Voiding that advance restored PARTIALLY_PAID, paid total 400.00, outstanding 653.00.
- Sales invoice base 300.00 + GST 54.00 - TDS 3.00 = payable 351.00. Approval posted SALE_OUT quantity -2 and value -200.00. Receipt/allocation of 351.00 made the invoice PAID.
- Final P1 stock was 5 units / 500.00, with project cost 600.00. Final P2 stock was 9 units / 900.00, with project cost 200.00.
- Vendor payable and aging totaled 653.00. Vendor net balance and final statement balance were -653.00. Customer net balance was 0.00.
- The database CHECK rejected negative OTHER / TRANSFER, MATERIAL / EXPENSE and MATERIAL / GRN entries. The signed transfer and bill-variance entries above succeeded.
- All 13 approval requests were linked from the rendered inbox/history. Their ten document types were PURCHASE_REQUEST, PURCHASE_ORDER, GRN, STOCK_TRANSFER, VENDOR_BILL, PAYMENT_REQUEST, SALES_INVOICE, TASK_SUBMISSION, TASK_DELAY and EXPENSE. Every destination returned 200 with no redirect and rendered its document code, task title or expense description in HTML outside serialized script payloads. Streamed server-rendering errors also fail the check.

Final smoke output:

```text
Receipts: P1 cost 1000.00; P2 cost 0.00; both PO received 10/20.
Consumption: P1 adds 0.00; P2 adds 200.00. Transfer: P1 -300.00; P2 adds 0.00. Unconfirmed setting switch rejected.
Bill: base 900.00 + GST 162.00 - TDS 9.00 = payable 1053.00; variance -100.00. Paid 400.00 -> 1053.00 -> void -> 400.00, outstanding 653.00.
Sale: base 300.00 + GST 54.00 - TDS 3.00 = 351.00; SALE_OUT -2 / -200.00; receipt 351.00 -> PAID. Final P1 stock 5 / 500.00, cost 600.00; P2 stock 9 / 900.00, cost 200.00. Vendor balance/statement -653.00; customer 0.00.
All 10 approval document types: inbox links return 200 and render. Negative cost CHECK rejects unrelated negatives.
```

## Bugs and test corrections

The inherited harness created task submission, task delay and expense requests after checking links. Those types were silently omitted. They now exist before link resolution, and an exact document-type assertion prevents a repeat. The Expense fixture supplies every required schema field and project relation; the full TypeScript gate includes all scripts.

The inherited rendering check accepted HTTP 200 responses containing Next.js rendering errors. It now checks rendered document content, rejects streamed errors and redirects, and verifies that the inbox actually contains each destination.

With the standalone smoke database pool still open, the local Prisma Postgres HTTP phase repeatedly failed with ECONNRESET / "Server has closed the connection". Equivalent standalone reads succeeded, and a fresh local database reproduced the overlap failure. Closing the standalone pool after creating fixtures and resolving links made every HTTP check pass, including a repeat without diagnostics. The harness now releases that pool before HTTP verification. No production pooling or feature logic was changed; the local server's internal reset cause remains undetermined.

No additional application logic bug was found. The existing registry regression test, finance tests and boundary assertion remain the relevant regression coverage. Temporary diagnostics and the experimental Next.js configuration change were removed.

## Gates

- `pnpm prisma validate`: PASS.
- `pnpm prisma generate`: PASS, Prisma Client 7.10.0. Generated files remain ignored.
- `pnpm exec tsc --noEmit`: PASS, including the smoke scripts.
- `pnpm format`: PASS.
- `pnpm lint`: PASS.
- `pnpm check:boundaries`: PASS, 404 source/script files.
- `pnpm test`: PASS, 45 passed / 1 skipped. The skip is the opt-in Postgres settlement test.
- `PAYMENTS_DB_TEST=local-only` with `pnpm exec node --import tsx --test src/modules/payment/server/service.test.ts`: PASS, 1 passed / 0 skipped. Its database fixtures rolled back.
- `pnpm smoke:phase3b`: PASS, including all ten document types and rendered inbox links.
- `pnpm build` with a placeholder localhost `DATABASE_URL`: PASS, all 59 pages generated without a live build database.

## Limits

- The smoke uses service calls and authenticated HTTP rendering. It does not exercise browser form interaction, hydration, file uploads, printing or concurrent-user load.
- Task submission, delay and expense fixtures verify pending-document links; this smoke does not approve them. Their effects remain covered by adjacent tests and earlier phase verification.
- Smoke fixtures remain in the isolated local database and the throwaway smoke user's password is updated each run. The settlement unit/integration test rolls back its separate fixtures.
- The pg driver emits a deprecation warning for concurrent queries on one transaction client. Current tests pass; pg 9 is not evaluated here.
- Documents and allocation currently require compatible currencies; this phase performs no exchange-rate conversion. Phase 3c introduces the multi-currency model described in PLAN.md. Stock remains valued at its existing moving average; the signed bill variance affects project costs without rewriting historic stock movements.
- Private attachment uploads retain the 900 KB limit. Finance lists load the accessible dataset without pagination. Phase 5 accounting journals and realised FX accounting are outside Phase 3b.
- No push was performed. `.env`, `src/generated` and `storage/` were not committed.
