# Stock adjustments

Stock on hand and Project materials now offer **Adjust stock** and an Adjustments history tab. Each entry records a project, existing stock-tracked item variant, date, direction, quantity in the stock UOM, reason and recording user. Entries cannot be edited or deleted through the application; corrections use another adjustment.

Decreases use moving average cost and clear the remaining value on full depletion. Increases require a nonnegative unit cost in the organization's base currency. Zero-value stock movements are allowed and do not create empty journals. Adjustments change inventory and accounting, rather than posting material consumption to the operational project cost ledger.

The `inventory.adjust` permission controls recording and variant search. Organization administrators and project managers can record adjustments; custom roles can receive the permission. Project context, organization and tenant item scope are checked on the server. Stock dates cannot predate an existing movement for the same project and variant. Accounting locks precede project stock locks; valuation is read again while holding those locks.

Stock, its journal and audit record commit together. Inventory gains debit Inventory and credit Inventory Adjustments; losses reverse those accounts. The new system account is `INVENTORY_ADJUSTMENT`, code `5140`, type Expense. Existing chart initialization creates missing defaults and rejects conflicting custom account codes. Accounting history synchronization now includes adjustments.

## Deployment

Apply migration `20261031000000_stock_adjustments` and regenerate Prisma Client before running the new application code. It adds nullable reason and recorder fields to stock movements; old rows remain compatible. No production migration or deployment was performed.

## Verification

- All 275 tests passed with no skips against a fresh disposable native PostgreSQL 17 database bound to loopback, including all opt-in database suites.
- The new database test checks fractional valuation, full depletion, journal direction and balance, recorder/audit data, permissions, project and tenant isolation, backdating, insufficient stock, two competing withdrawals on independent transactions, zero-value movements, database pagination/search and rollback after chart initialization fails.
- TypeScript, lint, module boundaries, Prisma validation and whitespace checks passed. Lint retains five existing accounting non-null assertion warnings.
- The final production build passed with an unreachable placeholder database. Verification exposed missing files behind the installed `@vercel/oidc@3.8.10` junction. A frozen reinstall did not restore them; the exact package archive was restored after checking its SHA-512 against the lockfile. Dependency versions and the lockfile did not change. Next.js 16.4.0 reported a known security vulnerability and recommends an upgrade.
- The UI detector reported no findings. Authenticated browser and device flows remain unverified: the isolated development copy encountered a Turbopack cache error, missing dependency files and browser timeouts. The existing development server was left running.
- After the final validation change, which ignores hidden increase-cost input when recording a decrease, the schema and live adjustment database tests and TypeScript check passed again. Lint, boundaries and the production build also passed again.

Environment files were not edited. The disposable PostgreSQL container and its data volume were removed. Build and test logs are under `.git/stock-adjustments-*.log`.
