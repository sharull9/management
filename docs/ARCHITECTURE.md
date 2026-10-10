# Code architecture

## Structure and rules

R1 preserves behavior and prepares four parallel R2 refactors on `build/foundation`. Naming follows `C:/sharull/coding/infoware/construction-erp/docs/agents/architecture.md` and its project/GRN modules. This app uses server actions instead of an external API layer.

```text
src/app/                         route entries
src/core/                        shared infrastructure
src/modules/<module>/
  server/                        actions.ts, queries.ts, service.ts, approval.ts, pure helpers, adjacent tests
  schema.ts                      Zod schemas
  type.ts                        types
  constants.ts / util.ts         constants and pure helpers
  ui/components/                 feature components
  ui/views/*-view.tsx             page content
  ui/layouts/*-layout.tsx         layout content
  index.ts                       public exports for other modules
src/components/shared/           shell, tables, pickers, forms, badges, loading, timeline bridge
src/components/ui/               generated shadcn primitives; never edit
src/lib/utils.ts                 shadcn's cn helper
```

`src/app` resolves params/searchParams, performs route-level authorization when needed, and renders module views inside Suspense. Put request-time resolution inside the boundary, preserving the installed Next.js Cache Components behavior. Layouts, loading/error boundaries, redirects, and HTTP handlers remain thin adapters. HTTP business logic belongs in module server files. Read relevant guides in `node_modules/next/dist/docs/` before Next.js edits.

Cross-module imports use `@/modules/<module>` through `index.ts`, or shared dependencies through `@/core/*` and `@/components/shared/*`. No deep imports into another module, even within one ownership group. Generated Prisma types and shadcn primitives retain their existing import paths. Only app adapters import module UI by path. Shared UI stays in `src/components/shared`.

Indexes export server-safe functions, types, constants, pure helpers, and server actions. Keep client components and views out of indexes. The approvals index also exports the stateless Server Component ApprovalTimeline for its shared bridge. Its four presentations preserve existing markup and dates. Client code must not import an index that loads server-only services. Dedicated pure indexes below contain no database imports, registrations, or server-only sentinels. Node unit tests use those indexes or adjacent files in their own module.

Approval handlers are registered in `src/modules/approvals/server/register.ts`, importing feature approval.ts exports through feature indexes. Preserve one registration per document type and existing eager registration. R1 deliberately retains CURRENT feature handler paths until their R2 owners repoint them.

One responsibility per file. Split files over approximately 400 lines. Put schemas in schema.ts, types in type.ts, queries in server/queries.ts, mutations in service files, and exported actions in files headed by `"use server"`. Split large views into components or named views. Tests live beside their code as `*.test.ts`.

`pnpm test` uses `node --import tsx --test "src/**/*.test.ts"`. Verified on Windows with Node 24.18.0: Node expands the quoted glob and discovers all 11 files. The existing Postgres settlement test remains opt-in with `PAYMENTS_DB_TEST=local-only`. Build with a placeholder DATABASE_URL requires no live database.

## Module list and merge decisions

| Owner | Modules | Responsibilities |
| --- | --- | --- |
| R1 | approvals | Engine, inbox, policy editor, links, registry, timeline, existing pure project-effects helpers |
| G1 | admin, organization, organization-auth | Tenants; orgs, members, roles, numbering, onboarding and org picker; setup/sign-in/out actions |
| G1 | masters | Location, UOM CRUD, categories/levels/items/variants, parties, tax CRUD; split implementation by domain within this module |
| G1 | item-variant, uom, tax | Pure variant identity, UOM conversion, tax calculation |
| G2 | project, project-stage, project-task, project-team, attendance, project-cost, workforce, dashboard | Projects/sites/budget/overview; stages; tasks/submissions/delays; team; attendance; costs/expenses/recognition; workers/designations/availability; dashboard |
| G2 | project-cost-policy | Pure material cost effects and recognition-change guard |
| G3 | procurement | Purchase request/order/GRN plus inventory stock/consumption/transfers; inventory services in server/inventory |
| G3 | vendor-bill, stock-valuation | Bills and attachments; pure moving-average valuation |
| G4 | payment, sales-invoice | Payment requests/payments/allocations/balances/statements/receipts; sales invoices |

Inventory shares document forms and submission flows with procurement, so both remain inside one parent module. Separate pure modules keep browser and unit-test imports free of database services. G2 owns the project materials route, which renders G3's inventory view by path from app.

## R2 export contract

Create these EXACT named exports with existing signatures, precision, return types, errors, and behavior. Consumers may change imports before producers land. Each group owns its modules' whole indexes and any further same-group export contracts.

| Owner | Import path | Agreed exports | Consumers |
| --- | --- | --- | --- |
| R1 | @/core/decimal | Decimal, money, type Numeric | All groups; procurement's precision-48 clone and half-up rounding |
| R1 | @/core/schema | id, date, quantity, rate | G3/G4 schemas; import directly instead of procurement |
| R1 | @/core/form-data | value, optional | G1 legacy action split |
| R1 | @/modules/approvals | types ApprovalHandler/Scope; getApprovalHandler, registerApprovalHandler, canActOnStep, registerManagerResolver, resolvePolicy, approvalDocumentLinks, financeDocumentTitles, actOnApproval, cancelApproval, listPendingForUser, submitForApproval, managerApprovers, submissionTaskEffect, Server Component ApprovalTimeline | All handlers/submitters and shared timeline bridge |
| G1 | @/modules/organization-auth | setupAction, signInAction, signOutAction | App and shared shell; index exports only server actions |
| G1 | @/modules/organization | saveOrganizationAction, saveMemberAction, removeMemberAction, saveRoleAction, deleteRoleAction, saveSeriesAction, provisionUser | G1 server consumers; admin provisioning |
| G1 | @/modules/admin | createTenantAction, tenantStatusAction | Admin adapters |
| G1 | @/modules/masters | resolveVariant, validateLocation, pickerItems, masterData, saveCityAction, deleteCityAction | G3 variant selection/queries, G4 item queries; server consumers |
| G1 | @/modules/item-variant | variantIdentity, type LevelConfig | G3 tests and shared picker; pure index |
| G1 | @/modules/uom | convertUom, type Unit | G3 stock/purchasing and G4 sales stock/tests; pure index |
| G1 | @/modules/tax | calculateTax, suggestTaxScope, type TaxInput | G3 purchase/bill calculations; G4 sales calculations/forms/tests; pure index |
| G2 | @/modules/project-cost-policy | materialCostEffects, assertCostRecognitionChange, type MaterialCostMode | G3 posting and G2 recognition tests; pure index |
| G2 | @/modules/project-cost | getProjectCostRecognition, validateProjectCostRecognitionChange, expenseApproval | G3 GRN/consumption/transfers, G2 settings, registry |
| G2 | @/modules/project-task | taskSubmissionApproval, taskDelayApproval, resolveTaskApprovalDocumentId | Registry and document links |
| G2 | @/modules/project | resolveProjectManagers, auditApprovalEffect | Registry; task/expense handlers |
| G3 | @/modules/procurement | registerProcurementHandlers, domainAudit, lockDocument, projectScope, selectedVariant, moduleProjectWhere, lockStockProjects, stockBalance, assertStockDate, recordConsumption, saveStockTransfer, saveGoodsReceipt, savePurchaseOrder, orderInput, receiptInput, consumptionInput, transferInput, procurementApprovalDocumentPaths, inventoryApprovalDocumentPaths | G2 stock locks; G4 finance visibility/sales services; registry/links/smoke script; server consumers |
| G3 | @/modules/stock-valuation | movingAverage | G3 posting and G4 stock/tests; pure index |
| G3 | @/modules/vendor-bill | vendorBillApproval, vendorBillApprovalDocumentPaths | Registry and links |
| G4 | @/modules/payment | paymentRequestApproval, paymentApprovalDocumentPaths | Registry and links |
| G4 | @/modules/sales-invoice | salesInvoiceApproval, salesInvoiceApprovalDocumentPaths | Registry and links |

Approval exports are objects of type ApprovalHandler containing existing onApproved/onRejected/onCanceled callbacks. Export them from server/approval.ts through each index. resolveProjectManagers preserves the existing manager resolver signature. auditApprovalEffect preserves the current register.ts audit helper signature. resolveTaskApprovalDocumentId(request) accepts the approvalDocumentLinks request projection and returns Promise<string | null>, preserving both tenant/project-scoped task submission/delay lookups and null for other document types.

Path exports are Partial<Record<DocumentType, string>> constants with these exact entries: procurementApprovalDocumentPaths has PURCHASE_REQUEST=`procurement/requests`, PURCHASE_ORDER=`procurement/orders`, GRN=`procurement/receipts`; inventoryApprovalDocumentPaths has STOCK_TRANSFER=`inventory/transfers`; vendorBillApprovalDocumentPaths has VENDOR_BILL=`procurement/bills`; paymentApprovalDocumentPaths has PAYMENT_REQUEST=`finance/payment-requests`; salesInvoiceApprovalDocumentPaths has SALES_INVOICE=`sales/invoices`. Keep URL construction/fallbacks and financeDocumentTitles in approvals unchanged.

## R2 parallel-work rules

1. Stay on build/foundation. Use git mv. Edit only your listed sources/targets, owned new module directories, and precise handoff lines below. Consumer owners update their own imports. Read other files freely. Keep core/shared unchanged except G1's two listed shared import handoffs.
2. Record the immutable R1 commit before work. Find the commit with subject `refactor(core): move shared infrastructure to src/core and approvals to a module`. G1/G2 copy pure blocks using `git show <R1-hash>:src/server/procurement/calculations.ts`, even after G3 moves it. G3 alone edits/removes that source. Copy unchanged logic using core Numeric/Decimal/money. Reading blocks does not grant source ownership.
3. Create agreed indexes first. Pure indexes export only pure files. Client components import their own actions/schema/calculations locally; cross-group pure dependencies use pure indexes. Leave no compatibility barrels under src/server after integration.
4. Preserve authorization, locks, transactions, audit writes, validation, and errors. No behavior changes, migrations, new UI, or changed URLs. Split large files by the responsibilities below.
5. Commit owned paths only with `git commit -- <paths>` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Quote paths and use `:(literal)` pathspecs for bracketed routes. List old and new rename paths. Never stage/commit all files. Retry transient index.lock failures after a short wait; do not delete another process's lock. Coordinate staging of registry/document-link hunks so a commit contains only its owner's changes.
6. Run pnpm exec tsc --noEmit. Temporary cross-group errors are acceptable ONLY for agreed exports or consumer imports whose owner has not completed its move. Record each error and owner; fix your own errors. Final integration requires zero errors.
7. During parallel work, format/lint only owned paths. The coordinator runs all five gates after integration: tsc, pnpm format, pnpm lint, pnpm test, pnpm build with placeholder DATABASE_URL. Retain discovery of all 11 original test files. Do not push or commit .env, src/generated, or storage/.

## Exact R2 ownership map

Each source belongs to exactly one of four groups. Route sources remain at their existing paths as thin adapters; the target column identifies extracted UI/handler destinations. Retain rows need no move. Tables exhaust the remaining src/server files, top-level feature components, bills/finance/sales components, and EVERY src/app/(app) file at R1. Setup/sign-in and smoke-script ownership is also included. R1 approvals routes are retained.

R1 completion check: all 138 remaining files under src/server, feature components outside ui/shared, and src/app/(app) have exactly one source row below. Every source row exists. Approval action/schema extraction remains G1's R2 work; the R1 inbox and policy views intentionally call the existing src/server/actions.ts exports.


### G1 org/admin/masters

| Existing source | Target or retained adapter |
| --- | --- |
| `src/server/actions.ts` | src/modules/organization/server/actions.ts; split blocks per G1 instructions |
| `src/server/masters/actions.ts` | src/modules/masters/server/actions.ts |
| `src/server/masters/queries.ts` | src/modules/masters/server/queries.ts |
| `src/server/masters/service.ts` | src/modules/masters/server/service.ts |
| `src/server/masters/variant.ts` | src/modules/item-variant/util.ts |
| `src/components/master-forms.tsx` | src/modules/masters/ui/components/master-forms.tsx |
| `src/components/organization-form.tsx` | src/modules/organization/ui/components/organization-form.tsx |
| `src/app/(app)/[org]/approvals/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/approvals/page.tsx` | Retain R1 thin route and approvals view |
| `src/app/(app)/[org]/layout.tsx` | Retain route; extract src/modules/organization/ui/layouts/organization-layout.tsx |
| `src/app/(app)/[org]/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/masters/categories/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/categories-view.tsx |
| `src/app/(app)/[org]/masters/items/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/items-view.tsx |
| `src/app/(app)/[org]/masters/levels/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/levels-view.tsx |
| `src/app/(app)/[org]/masters/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/masters/locations/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/locations-view.tsx |
| `src/app/(app)/[org]/masters/parties/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/parties-view.tsx |
| `src/app/(app)/[org]/masters/tax/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/tax-view.tsx |
| `src/app/(app)/[org]/masters/uoms/page.tsx` | Retain route; extract/render src/modules/masters/ui/views/uoms-view.tsx |
| `src/app/(app)/[org]/settings/approval-policies/page.tsx` | Retain R1 thin route and approvals view |
| `src/app/(app)/[org]/settings/layout.tsx` | Retain route; extract src/modules/organization/ui/layouts/settings-layout.tsx |
| `src/app/(app)/[org]/settings/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/settings/members/page.tsx` | Retain route; extract/render src/modules/organization/ui/views/members-view.tsx |
| `src/app/(app)/[org]/settings/numbering/page.tsx` | Retain route; extract/render src/modules/organization/ui/views/numbering-view.tsx |
| `src/app/(app)/[org]/settings/organizations/page.tsx` | Retain route; extract/render src/modules/organization/ui/views/organizations-view.tsx |
| `src/app/(app)/[org]/settings/page.tsx` | Retain settings redirect inside Suspense |
| `src/app/(app)/[org]/settings/roles/page.tsx` | Retain route; extract/render src/modules/organization/ui/views/roles-view.tsx |
| `src/app/(app)/admin/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/admin/page.tsx` | Retain route; extract/render src/modules/admin/ui/views/admin-view.tsx |
| `src/app/(app)/error.tsx` | Retain route; extract/render src/modules/organization/ui/views/workspace-error-view.tsx |
| `src/app/(app)/layout.tsx` | Retain thin passthrough layout |
| `src/app/(app)/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/page.tsx` | Retain route; extract/render src/modules/organization/ui/views/organization-picker-view.tsx |
| `src/app/setup/page.tsx` | Retain route; extract src/modules/organization/ui/views/setup-view.tsx |
| `src/app/sign-in/page.tsx` | Retain route; extract src/modules/organization/ui/views/sign-in-view.tsx |

#### G1 splits and handoff lines

Own every new file below admin, organization, organization-auth, masters, item-variant, uom, and tax. Split src/server/actions.ts by these exact existing exports:

| Existing block | Destination |
| --- | --- |
| setupAction, signInAction, signOutAction | src/modules/organization-auth/server/actions.ts |
| createTenantAction, tenantStatusAction | src/modules/admin/server/actions.ts |
| saveOrganizationAction | src/modules/organization/server/actions.ts |
| saveMemberAction, removeMemberAction | src/modules/organization/server/member-actions.ts |
| saveRoleAction, deleteRoleAction | src/modules/organization/server/role-actions.ts |
| saveSeriesAction | src/modules/organization/server/numbering-actions.ts |
| saveCityAction, deleteCityAction | src/modules/masters/server/location-actions.ts |
| savePolicyAction, approvalDecisionAction, cancelApprovalAction | src/modules/approvals/server/actions.ts |
| stepSchema and approval-specific Zod input schemas | src/modules/approvals/schema.ts |
| provisionUser | src/modules/organization/server/provision-user.ts |

Move other schemas to the corresponding module's schema.ts. Export provisionUser through organization for admin's server call, preserving trusted provisioning checks in the callers. The shell uses the action-only organization-auth index, so it never imports provisioning services.

Split masters/actions.ts into thin dispatcher actions plus masters/server/item-service.ts, uom-service.ts, party-service.ts, tax-service.ts. Location actions use location-actions.ts. Split master-forms.tsx into masters/ui/components/uom-forms.tsx, item-forms.tsx, party-forms.tsx, tax-forms.tsx; master-forms.tsx can remain a small module-local dispatcher. Schemas/types belong in masters/schema.ts and masters/type.ts. Further splits within these owned module directories must respect the size limit.

Copy convertUom and type Unit from the immutable R1 calculations snapshot to src/modules/uom/util.ts. Copy suggestTaxScope, calculateTax, type TaxInput to src/modules/tax/util.ts. Use core Numeric/Decimal/money. G3 alone removes these definitions from its owned source. Their pure indexes export exactly the contract names.

Only G1 may update these existing R1/shared imports: signOutAction in src/components/shared/app-shell.tsx to @/modules/organization-auth; LevelConfig in src/components/shared/item-picker.tsx to @/modules/item-variant; savePolicyAction in approvals/ui/views/approval-policies-view.tsx and approvalDecisionAction/cancelApprovalAction in approvals/ui/views/approvals-view.tsx to the local ../../server/actions. G1 owns the new approvals/actions and schema files and may append those three action exports to src/modules/approvals/index.ts. Leave every other approvals export unchanged.

Registry/document-link edits: none. R1 approvals routes need no further content move. All shared paths other than the two precise import lines are read-only.

### G2 projects and workforce

| Existing source | Target or retained adapter |
| --- | --- |
| `src/server/procurement/cost-recognition.test.ts` | src/modules/project-cost-policy/util.test.ts |
| `src/server/procurement/cost-recognition.ts` | src/modules/project-cost/server/cost-recognition.ts |
| `src/server/projects/actions.ts` | src/modules/project/server/actions.ts; split blocks per G2 instructions |
| `src/server/projects/availability.test.ts` | src/modules/workforce/server/availability.test.ts |
| `src/server/projects/availability.ts` | src/modules/workforce/server/availability.ts |
| `src/server/projects/costing.test.ts` | src/modules/attendance/server/costing.test.ts |
| `src/server/projects/costing.ts` | src/modules/attendance/server/costing.ts |
| `src/server/projects/queries.ts` | src/modules/project/server/queries.ts; projectSpent to project-cost/server/queries.ts |
| `src/components/attendance-grid.tsx` | src/modules/attendance/ui/components/attendance-grid.tsx |
| `src/components/project-forms.tsx` | src/modules/project/ui/components/project-form.tsx |
| `src/components/site-form.tsx` | src/modules/project/ui/components/site-form.tsx |
| `src/app/(app)/[org]/page.tsx` | Retain route; extract/render src/modules/dashboard/ui/views/dashboard-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/attendance/page.tsx` | Retain route; extract/render src/modules/attendance/ui/views/attendance-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/budget/page.tsx` | Retain route; extract/render src/modules/project/ui/views/project-budget-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/costs/page.tsx` | Retain route; extract/render src/modules/project-cost/ui/views/costs-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/layout.tsx` | Retain route; extract src/modules/project/ui/layouts/project-overview-layout.tsx |
| `src/app/(app)/[org]/projects/[projectId]/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/projects/[projectId]/materials/page.tsx` | Retain route; render src/modules/procurement/ui/views/inventory-view.tsx owned by G3 |
| `src/app/(app)/[org]/projects/[projectId]/page.tsx` | Retain route; extract/render src/modules/project/ui/views/project-overview-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/sites/page.tsx` | Retain route; extract/render src/modules/project/ui/views/project-sites-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/stages/page.tsx` | Retain route; extract/render src/modules/project-stage/ui/views/stages-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/tasks/[taskId]/page.tsx` | Retain route; extract/render src/modules/project-task/ui/views/task-detail-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/tasks/page.tsx` | Retain route; extract/render src/modules/project-task/ui/views/tasks-view.tsx |
| `src/app/(app)/[org]/projects/[projectId]/team/page.tsx` | Retain route; extract/render src/modules/project-team/ui/views/team-view.tsx |
| `src/app/(app)/[org]/projects/page.tsx` | Retain route; extract/render src/modules/project/ui/views/projects-view.tsx |
| `src/app/(app)/[org]/workforce/page.tsx` | Retain route; extract/render src/modules/workforce/ui/views/workforce-view.tsx |

#### G2 splits and handoff lines

Own every new file below project, project-stage, project-task, project-team, attendance, project-cost, project-cost-policy, workforce, and dashboard. Split projects/actions.ts by these exact existing exports:

| Existing export | Destination |
| --- | --- |
| saveProjectAction | src/modules/project/server/actions.ts |
| siteAction | src/modules/project/server/site-actions.ts |
| budgetAction | src/modules/project/server/budget-actions.ts |
| saveProjectCostRecognitionAction, expenseAction | src/modules/project-cost/server/actions.ts |
| saveStageAction, deleteStageAction | src/modules/project-stage/server/actions.ts |
| saveTaskAction | src/modules/project-task/server/actions.ts |
| taskWorkAction | src/modules/project-task/server/work-actions.ts |
| teamAction | src/modules/project-team/server/actions.ts |
| attendanceAction | src/modules/attendance/server/actions.ts |
| saveWorkerAction, designationAction | src/modules/workforce/server/actions.ts |

Move schemas/mutations into each module's schema.ts/service.ts. Split taskWorkAction into submission/delay service files if needed. Preserve names/signatures, locks, transactions and authorization. Export any same-group dependencies through their owning indexes.

Split remaining project-forms.tsx into project/ui/components/project-form.tsx, project-stage/ui/components/stage-form.tsx, project-task/ui/components/task-form.tsx, workforce/ui/components/worker-form.tsx, project-cost/ui/components/project-cost-recognition-form.tsx. The generic options/date helper, CostTypeField, MaterialCostRecognitionFields and recognition badge are already shared. Use their shared paths.

Move costing.ts/test to attendance, then extract budgetUsage and its existing test coverage to project-cost/server/budget-usage.ts and budget-usage.test.ts. Keep PayTerms and attendanceCost together. The G2-owned recognition helper/test sources are exceptions to the procurement folder's G3 ownership. Copy MaterialCostMode, materialCostEffects, assertCostRecognitionChange from the immutable R1 calculations snapshot to project-cost-policy/util.ts; G3 alone removes them from its source. The recognition test moves to project-cost-policy/util.test.ts and imports that pure module locally.

Register edits: G2 owns imports of writeAudit, ApprovalRequest/Prisma, registerManagerResolver, managerApprovers/submissionTaskEffect and the whole BEGIN R2 G2 project handlers through END R2 G2 project handlers block. Extract audit to project/server/approval-audit.ts as auditApprovalEffect; submission/delay handlers to project-task/server/approval.ts; expense handlers to project-cost/server/approval.ts; manager resolver to project/server/approval.ts. Import the agreed named exports through their indexes. Replace the marked block with TASK_SUBMISSION, TASK_DELAY and EXPENSE handler registrations plus registerManagerResolver(resolveProjectManagers). Keep the shared registerApprovalHandler import and other groups' registrations intact.

Document-link edits: G2 owns its db import and only the marked task document lookup block. Replace the block with `const taskId = await resolveTaskApprovalDocumentId(r)` and add the project-task index import. Keep project tasks/costs URLs and the null-project guard unchanged. Leave G3/G4 map entries alone.

G2's project materials route imports G3's src/modules/procurement/ui/views/inventory-view.tsx by path from app. G3 alone moves inventory-pages.tsx. Do not edit recognition consumers in G3 files; their owners update their imports.

### G3 procurement and inventory

| Existing source | Target or retained adapter |
| --- | --- |
| `src/server/bills/actions.ts` | src/modules/vendor-bill/server/actions.ts |
| `src/server/bills/approval.ts` | src/modules/vendor-bill/server/approval.ts |
| `src/server/bills/calculations.test.ts` | src/modules/vendor-bill/server/calculations.test.ts |
| `src/server/bills/calculations.ts` | src/modules/vendor-bill/server/calculations.ts |
| `src/server/bills/index.ts` | src/modules/vendor-bill/index.ts |
| `src/server/bills/queries.ts` | src/modules/vendor-bill/server/queries.ts |
| `src/server/bills/service.ts` | src/modules/vendor-bill/server/service.ts |
| `src/server/bills/validation.test.ts` | src/modules/vendor-bill/server/validation.test.ts |
| `src/server/bills/validation.ts` | src/modules/vendor-bill/schema.ts |
| `src/server/inventory/service.ts` | src/modules/procurement/server/inventory/service.ts |
| `src/server/procurement/actions.ts` | src/modules/procurement/server/actions.ts |
| `src/server/procurement/approvals.ts` | src/modules/procurement/server/approval.ts |
| `src/server/procurement/calculations.test.ts` | src/modules/procurement/server/calculations.test.ts |
| `src/server/procurement/calculations.ts` | src/modules/procurement/server/calculations.ts; movingAverage to src/modules/stock-valuation/util.ts; G1/G2 pure blocks copied by their owners |
| `src/server/procurement/queries.ts` | src/modules/procurement/server/queries.ts |
| `src/server/procurement/service.ts` | src/modules/procurement/server/service.ts |
| `src/server/procurement/submission.ts` | src/modules/procurement/server/submission.ts |
| `src/server/procurement/validation.ts` | src/modules/procurement/schema.ts |
| `src/components/inventory-pages.tsx` | src/modules/procurement/ui/views/inventory-view.tsx |
| `src/components/procurement-form.tsx` | src/modules/procurement/ui/components/procurement-form.tsx |
| `src/components/procurement-lines.tsx` | src/modules/procurement/ui/components/procurement-lines.tsx |
| `src/components/procurement-pages.tsx` | src/modules/procurement/ui/views/procurement-list-view.tsx |
| `src/components/bills/form.tsx` | src/modules/vendor-bill/ui/components/vendor-bill-form.tsx |
| `src/components/bills/pages.tsx` | src/modules/vendor-bill/ui/views/vendor-bill-list-view.tsx; split named views per group instructions |
| `src/app/(app)/[org]/inventory/consumption/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/consumption-list-view.tsx |
| `src/app/(app)/[org]/inventory/stock/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/stock-list-view.tsx |
| `src/app/(app)/[org]/inventory/transfers/[documentId]/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/transfers-detail-view.tsx |
| `src/app/(app)/[org]/inventory/transfers/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/transfers-list-view.tsx |
| `src/app/(app)/[org]/procurement/bills/[billId]/attachments/[attachmentId]/route.ts` | Retain HTTP route; delegate to src/modules/vendor-bill/server/attachment.ts |
| `src/app/(app)/[org]/procurement/bills/[billId]/page.tsx` | Retain route; extract/render src/modules/vendor-bill/ui/views/bills-detail-view.tsx |
| `src/app/(app)/[org]/procurement/bills/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/procurement/bills/new/page.tsx` | Retain route; extract/render src/modules/vendor-bill/ui/views/bills-new-view.tsx |
| `src/app/(app)/[org]/procurement/bills/page.tsx` | Retain route; extract/render src/modules/vendor-bill/ui/views/bills-list-view.tsx |
| `src/app/(app)/[org]/procurement/orders/[documentId]/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/orders-detail-view.tsx |
| `src/app/(app)/[org]/procurement/orders/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/orders-list-view.tsx |
| `src/app/(app)/[org]/procurement/receipts/[documentId]/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/receipts-detail-view.tsx |
| `src/app/(app)/[org]/procurement/receipts/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/receipts-list-view.tsx |
| `src/app/(app)/[org]/procurement/requests/[documentId]/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/requests-detail-view.tsx |
| `src/app/(app)/[org]/procurement/requests/page.tsx` | Retain route; extract/render src/modules/procurement/ui/views/requests-list-view.tsx |
| `scripts/phase3a-smoke-verify.ts` | Retain script; rewrite remaining legacy imports to agreed indexes/core |

#### G3 splits and handoff lines

Own every new file below procurement, vendor-bill, stock-valuation, plus the smoke script in the table. Procurement includes inventory. Split procurement/service.ts into server/request-service.ts, order-service.ts, receipt-service.ts, keeping domainAudit/projectScope/siteInProject/selectedVariant/lockDocument in server/service.ts. Thin actions delegate to those files. Inventory services live in server/inventory. Split approval.ts into server/receipt-approval.ts and transfer-approval.ts as needed, keeping registerProcurementHandlers in server/approval.ts. Export stock locks/services through the procurement index.

Extract movingAverage unchanged to stock-valuation/util.ts. Rewrite tax/UOM/material policy imports to G1/G2 pure indexes, then remove old definitions and core reexports from calculations.ts. Keep assertReceiptQuantity in procurement/server/calculations.ts. Its source belongs only to G3; G1/G2 copy pure blocks from the immutable snapshot. Keep original test cases; calculations.test.ts may become a small regression file exercising the agreed pure indexes, with new adjacent test files when split by responsibility. Pure tests must not import procurement's server-only index.

Split procurement-pages.tsx into ui/views/procurement-list-view.tsx and procurement-detail-view.tsx, extracting formData to util.ts and shared draft types to type.ts. Procurement forms/lines and inventory views remain in this parent module. Expose InventoryView in ui/views/inventory-view.tsx, preserving the current InventoryPage org/kind/projectId props and behavior. Route-specific views listed in the table can be small module-local adapters selecting those existing views; avoid duplicating UI logic.

Split vendor-bill pages into ui/views/vendor-bill-list-view.tsx, vendor-bill-new-view.tsx, vendor-bill-detail-view.tsx and smaller components. Feature validation moves to schema.ts. Split long bill forms/services by responsibility within vendor-bill. The attachment route delegates to vendor-bill/server/attachment.ts with unchanged permission checks, headers/statuses and storage handling.

Register edits: repoint only the marked billApproval import to named vendorBillApproval from @/modules/vendor-bill and registerProcurementHandlers to @/modules/procurement. Change the VENDOR_BILL registration argument to vendorBillApproval; retain the procurement registration call and document types. Leave G2/G4 imports and blocks alone.

Document-link edits: add G3 imports for procurementApprovalDocumentPaths/inventoryApprovalDocumentPaths from procurement and vendorBillApprovalDocumentPaths from vendor-bill. Replace only marked G3 map entries with spreads of those constants, preserving values. Leave G2's query block and G4's entries/titles alone.

G2 owns both cost-recognition source files currently under procurement. The G2 materials route renders your InventoryView. Smoke-script imports use core Decimal, masters resolveVariant, and the agreed procurement stock/service/schema exports.

### G4 finance and sales

| Existing source | Target or retained adapter |
| --- | --- |
| `src/server/payments/actions.ts` | src/modules/payment/server/actions.ts |
| `src/server/payments/allocation.test.ts` | src/modules/payment/server/allocation.test.ts |
| `src/server/payments/allocation.ts` | src/modules/payment/server/allocation.ts |
| `src/server/payments/approval.ts` | src/modules/payment/server/approval.ts |
| `src/server/payments/index.ts` | src/modules/payment/index.ts |
| `src/server/payments/queries.ts` | src/modules/payment/server/queries.ts |
| `src/server/payments/service.test.ts` | src/modules/payment/server/service.test.ts |
| `src/server/payments/service.ts` | src/modules/payment/server/service.ts |
| `src/server/payments/submission.ts` | src/modules/payment/server/submission.ts |
| `src/server/payments/validation.ts` | src/modules/payment/schema.ts |
| `src/server/sales/actions.ts` | src/modules/sales-invoice/server/actions.ts |
| `src/server/sales/approval.ts` | src/modules/sales-invoice/server/approval.ts |
| `src/server/sales/calculations.test.ts` | src/modules/sales-invoice/server/calculations.test.ts |
| `src/server/sales/calculations.ts` | src/modules/sales-invoice/server/calculations.ts |
| `src/server/sales/index.ts` | src/modules/sales-invoice/index.ts |
| `src/server/sales/queries.ts` | src/modules/sales-invoice/server/queries.ts |
| `src/server/sales/service.ts` | src/modules/sales-invoice/server/service.ts |
| `src/server/sales/stock.ts` | src/modules/sales-invoice/server/stock.ts |
| `src/server/sales/validation.ts` | src/modules/sales-invoice/schema.ts |
| `src/components/finance/forms.tsx` | src/modules/payment/ui/components/payment-form.tsx; split request/allocation forms |
| `src/components/finance/pages.tsx` | src/modules/payment/ui/views/payment-list-view.tsx; split named views per group instructions |
| `src/components/sales/invoice-form.tsx` | src/modules/sales-invoice/ui/components/invoice-form.tsx |
| `src/components/sales/pages.tsx` | src/modules/sales-invoice/ui/views/sales-invoice-list-view.tsx; split named views per group instructions |
| `src/app/(app)/[org]/finance/balances/[partyId]/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/balances-detail-view.tsx |
| `src/app/(app)/[org]/finance/balances/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/finance/balances/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/balances-list-view.tsx |
| `src/app/(app)/[org]/finance/payment-requests/[id]/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/payment-requests-detail-view.tsx |
| `src/app/(app)/[org]/finance/payment-requests/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/finance/payment-requests/new/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/payment-requests-new-view.tsx |
| `src/app/(app)/[org]/finance/payment-requests/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/payment-requests-list-view.tsx |
| `src/app/(app)/[org]/finance/payments/[id]/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/payments-detail-view.tsx |
| `src/app/(app)/[org]/finance/payments/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/finance/payments/new/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/payments-new-view.tsx |
| `src/app/(app)/[org]/finance/payments/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/payments-list-view.tsx |
| `src/app/(app)/[org]/sales/invoices/[invoiceId]/page.tsx` | Retain route; extract/render src/modules/sales-invoice/ui/views/invoices-detail-view.tsx |
| `src/app/(app)/[org]/sales/invoices/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/sales/invoices/new/page.tsx` | Retain route; extract/render src/modules/sales-invoice/ui/views/invoices-new-view.tsx |
| `src/app/(app)/[org]/sales/invoices/page.tsx` | Retain route; extract/render src/modules/sales-invoice/ui/views/invoices-list-view.tsx |
| `src/app/(app)/[org]/sales/receipts/loading.tsx` | Retain; reexport @/components/shared/page-loading |
| `src/app/(app)/[org]/sales/receipts/page.tsx` | Retain route; extract/render src/modules/payment/ui/views/receipts-list-view.tsx |

#### G4 splits and handoff lines

Own every new file below payment and sales-invoice. Split finance/forms.tsx into payment/ui/components/payment-form.tsx, request-form.tsx and allocation-form.tsx, with form types in payment/type.ts. Split finance/pages.tsx into payment/ui/views/payment-list-view.tsx, payment-new-view.tsx, request-detail-view.tsx, payment-detail-view.tsx, balances-view.tsx, statement-view.tsx and smaller components. Route-specific listed views may be thin module-local adapters selecting these existing views. Keep receipts in payment and preserve their sales permission behavior.

Split payment/service.ts into request-service.ts, payment-service.ts, allocation-service.ts and void-service.ts if needed for the size limit. Preserve settlement locks, transactions and tests, including the opt-in Postgres skip. Move validation to schema.ts. Keep tests adjacent to their implementation.

Split sales/pages.tsx into sales-invoice/ui/views/invoice-list-view.tsx, invoice-new-view.tsx, invoice-detail-view.tsx and ui/components/invoice-edit.tsx. Keep invoice-form.tsx, extract types to type.ts, and use the listed route-specific views as thin local adapters when needed. Use core decimal/schema; G1 tax/uom/item-query exports; G3 stock-valuation movingAverage; procurement domainAudit/lockDocument/selectedVariant/moduleProjectWhere. TaxInput imports are type-only from tax. Pure sales tests must not import procurement's server-only index.

Register edits: repoint only marked paymentRequestApproval/salesInvoiceApproval imports to the named exports from payment/sales-invoice indexes. Keep those existing registration names and document types. Leave G2/G3 blocks alone.

Document-link edits: add only paymentApprovalDocumentPaths and salesInvoiceApprovalDocumentPaths imports. Replace only marked PAYMENT_REQUEST/SALES_INVOICE entries with spreads. Leave G3 paths, G2 queries and financeDocumentTitles unchanged.


## Pending integration items

- The database CHECK constraint forbids negative CostEntry amounts. Phase 3b requires negatives for TRANSFER source entries using ON_RECEIPT and BILL_VARIANCE. A migration is needed; see [PHASE3B_COST_RECOGNITION.md](PHASE3B_COST_RECOGNITION.md). Do not implement it in R1/R2.
- The opt-in Postgres settlement integration test still requires an explicitly configured local database. Ordinary gates preserve its skip condition.
