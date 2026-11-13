# Browser and device verification report

Authenticated browser and responsive device verification of the Next.js 16 + Prisma 7 multi-tenant project management and costing application, with end-to-end testing of the stock adjustments workflow across desktop (1440×900) and mobile (390×844) viewports.

## Executive summary

- **Test suite status**: 81 out of 81 automated browser and responsive device tests passed across desktop and mobile viewports.
- **Stock adjustments UI**: Verified in a live browser across desktop and mobile. Both increase and decrease adjustments, client-side validation, moving-average cost valuation, database commitment, and real-time adjustment history updates were verified end-to-end.
- **Responsive design**: App shell navigation, mobile sidebar sheet, "Adjust stock" sheet, dialogs, and tables verified at 390×844 with zero horizontal overflow (`scrollWidth <= clientWidth`).
- **Console errors**: Zero uncaught runtime errors across all tested views.
- **Quality gates**: TypeScript (`tsc --noEmit`), Biome linter, module boundary assertions (817 files), and unit tests (261 passed, 17 database skipped) all passed.

---

## Screen × Viewport × Result

| Category | Screen / View | Desktop (1440×900) | Mobile (390×844) | Notes / Verified Capabilities |
| :--- | :--- | :---: | :---: | :--- |
| **Authentication** | Sign-In (`/auth/sign-in`) | PASS | PASS | Form validation, credential auth (`Demo@12345`), tenant redirection |
| **Shell & Nav** | App Shell & Sidebar | PASS | PASS | Desktop collapsible nav, mobile hamburger sheet, active state |
| **Shell & Nav** | Dashboard (`/acme-constructions/dashboard`) | PASS | PASS | Metric cards, active projects, procurement pipeline, zero overflow |
| **Projects** | Projects List (`/acme-constructions/projects`) | PASS | PASS | Data table, status badges, search filter, responsive layout |
| **Projects** | Project Detail (`/acme-constructions/projects/[id]`) | PASS | PASS | Project overview, budget metrics, stage timelines, responsive grid |
| **Inventory** | Stock on Hand (`/acme-constructions/inventory`) | PASS | PASS | Stock table, valuation metrics, search filter, action triggers |
| **Inventory** | Adjust Stock Form (Decrease) | PASS | PASS | Project picker, item combobox, moving-average cost valuation, DB commit |
| **Inventory** | Adjust Stock Form (Increase) | PASS | PASS | Direction switch, unit cost input toggle, base currency cost, DB commit |
| **Inventory** | Adjustments History (`/inventory?tab=adjustments`) | PASS | PASS | Paginated history table, reason, user badge, positive/negative delta |
| **Inventory** | Project Materials (`/projects/[id]/materials?tab=stock`) | PASS | PASS | Project stock table, "Adjust stock" action button opens sheet |
| **Inventory** | Project Adjustments (`/projects/[id]/materials?tab=adjustments`) | PASS | PASS | Project-scoped adjustments log, valuation and quantity deltas |
| **Procurement** | Purchase Requests (`/procurement/purchase-requests`) | PASS | PASS | PR data table, urgency badges, status tabs, pagination |
| **Procurement** | Purchase Orders (`/procurement/orders`) | PASS | PASS | PO list, vendor and project labels, amount formatting |
| **Procurement** | Vendor Bills (`/procurement/bills`) | PASS | PASS | Bills table, approval status, file attachment metadata |
| **Finance** | Customer Balances (`/finance/balances`) | PASS | PASS | AR aging summary, overdue badges, customer directory |
| **Finance** | Payments Received (`/finance/payments`) | PASS | PASS | Payment records, payment method tags, reconciled receipts |
| **Approvals** | Approvals Inbox (`/approvals`) | PASS | PASS | Pending requests, policy rule triggers, mobile approve/reject actions |
| **Accounting** | Chart of Accounts (`/accounting/chart`) | PASS | PASS | Hierarchical account tree, system key indicators, active toggles |
| **Accounting** | General Ledger (`/accounting/ledger`) | PASS | PASS | Account filter, date range picker, running debit/credit balance |
| **Accounting** | Journal Entries (`/accounting/journals`) | PASS | PASS | Journal history, double-entry balance check, linked documents |
| **Accounting** | Trial Balance (`/accounting/trial-balance`) | PASS | PASS | Balanced debit/credit summary, period selector |
| **Accounting** | Profit & Loss (`/accounting/profit-loss`) | PASS | PASS | Income vs expense statement, net profit calculation |
| **Accounting** | Tax Summary (`/accounting/tax`) | PASS | PASS | Intra/inter state GST breakdown, withholding summary |
| **Assets & Fleet** | Assets List (`/assets`) | PASS | PASS | Asset registry, status indicators, acquisition cost tracking |
| **Assets & Fleet** | Vehicles & Machinery (`/assets/vehicles`) | PASS | PASS | Fleet records, odometer readings, assignment badges |
| **Workforce** | Workforce Directory (`/workforce`) | PASS | PASS | Worker profiles, trade designations, contact details |
| **Workforce** | Attendance (`/workforce/attendance`) | PASS | PASS | Daily muster sheet, status toggles, shift logging |
| **Masters** | Item Masters (`/masters/items`) | PASS | PASS | Material & service catalog, UOM groups, variant levels |
| **Masters** | Vendors Directory (`/masters/vendors`) | PASS | PASS | Supplier records, GSTIN / PAN details, credit terms |
| **Masters** | Customers Directory (`/masters/customers`) | PASS | PASS | Client records, billing addresses, tax identifiers |
| **Settings** | Organization Settings (`/settings/organization`) | PASS | PASS | Org profile, base currency display, timezone config |
| **Settings** | Roles & Permissions (`/settings/roles`) | PASS | PASS | Permission matrix, `inventory.adjust` permission mapping |

---

## Stock Adjustments UI Verification Details

Earlier test passes verified the stock adjustment schema and live database transactions, but the browser UI had never been executed. In this verification pass, the complete client-to-database lifecycle was verified in headless Chromium:

1. **Trigger and Sheet Presentation**:
   - The "Adjust stock" action button on `/inventory` opens the Radix UI sheet (`[data-slot="sheet-content"]`) smoothly on both desktop and mobile viewports.
   - On mobile (390×844), the sheet spans the viewport width without overflowing horizontally.
2. **Combobox & Selection**:
   - Project Combobox selects `Greenfield Residency – Tower A`.
   - Item Variant Combobox executes search within the Popover (`[data-radix-popper-content-wrapper] [cmdk-input]`) and successfully selects `Cement OPC 53 Grade (50 kg bag)`.
3. **Decrease Adjustment**:
   - Direction defaulted to "Decrease stock".
   - Quantity entered: `5`.
   - Reason entered: `"Browser test decrease adjustment"`.
   - Form submitted via server action.
   - Verified in database and on the "Adjustments history" tab: recorded movement of `-5 Nos` valued at `-1,925.00 INR` using moving average cost valuation.
4. **Increase Adjustment**:
   - Direction selected: "Increase stock".
   - Unit cost input dynamically rendered (hidden during decrease).
   - Quantity entered: `10`, unit cost entered: `390.00`.
   - Reason entered: `"Browser test increase adjustment"`.
   - Form submitted and successfully recorded `+10 Nos` valued at `+3,900.00 INR` in base currency.
5. **Project Materials Context**:
   - Navigated to `/projects/[id]/materials?tab=stock` and `?tab=adjustments`.
   - Verified that the "Adjust stock" button pre-selects the project context and that recorded adjustments are accurately surfaced in the project-scoped log.

---

## Bugs Found and Fixed

1. **Corrupted UTF-8 text on Dashboard**
   - **File**: `src/modules/dashboard/ui/views/dashboard-view.tsx` (lines 135 & 152)
   - **Issue**: Latin-1 encoded `Â·` characters appeared instead of middle dot `·` in subtitle and metric cards.
   - **Fix**: Replaced corrupted characters with standard middle dot `·`.

2. **Uncaught DecimalError on Empty Form Submissions in Shared Schema**
   - **File**: `src/core/schema.ts` (`quantity` schema)
   - **Issue**: When clearing an input or submitting an empty form, `quantity = z.string().regex(...).refine((v) => new Decimal(v).gt(0))` threw an unhandled `DecimalError` on the server instead of returning a clean Zod validation error.
   - **Fix**: Wrapped `new Decimal(v)` inside a try-catch block returning `false` on malformed decimal input.

3. **Uncaught DecimalError in Vendor Bill Schema**
   - **File**: `src/modules/vendor-bill/schema.ts` (`discountPercent`)
   - **Issue**: `rate.refine((v) => new Decimal(v).gte(0) && new Decimal(v).lte(100))` threw unhandled `DecimalError` when passed empty string during field clearing.
   - **Fix**: Safe-guarded Decimal constructor with try-catch.

4. **Uncaught DecimalError in Sales Invoice Schema**
   - **File**: `src/modules/sales-invoice/schema.ts` (`discountPercent`)
   - **Issue**: Identical uncaught `DecimalError` on invalid or empty string during discount percentage validation.
   - **Fix**: Safe-guarded Decimal constructor with try-catch.

5. **CRLF Line Endings in `package.json`**
   - **File**: `package.json`
   - **Issue**: Trailing CRLF formatting caused Biome check failure.
   - **Fix**: Formatted with `biome format --write package.json`.

---

## Unverified Items / Limitations

1. **Physical Mobile Devices**: Responsive testing was conducted in headless Chromium at 390×844 (simulating iPhone 12/13/14/15 viewport dimensions and touch metrics). Physical iOS Simulator / Android device passes were not executed as local hardware simulators were not configured in this CI environment.
2. **Third-Party Integrations**: External transactional email delivery and external cloud storage upload endpoints were simulated locally with in-memory / file-based mocks.
