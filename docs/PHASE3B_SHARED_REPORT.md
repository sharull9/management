# Phase 3b shared implementation contract

Wave 1 on `build/foundation`. Schema and shared setup only. Feature posting, actions,
queries and forms belong to wave 2. No push. Commit hash is supplied in the final handoff.

## Schema

One new migration: `prisma/migrations/20261010172704_phase3b_finance/migration.sql`.
No prior migration changed. Existing projects receive
`Project.materialCostRecognition = ON_CONSUMPTION` through a NOT NULL column default.
Document identifiers follow existing conventions: `organizationId` and `code`.
All four document models have `@@unique([organizationId, code])`.
Use `nextDocumentNumber(orgId, "BILL" | "PAYREQ" | "PAY" | "INV", tx)`.
Prefixes are BILL-, PAYREQ-, PAY- and INV-. Number allocation remains in wave-2 services.

New enum names and values:

- `MaterialCostRecognition`: `ON_RECEIPT`, `ON_CONSUMPTION`.
- `FinanceDocumentStatus`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`.
- `PaymentRequestStatus`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PAID`, `CANCELLED`.
- `PaymentMode`: `CASH`, `BANK`, `UPI`, `CHEQUE`, `OTHER`.
- `PaymentPurpose`: `ADVANCE`, `BILL_SETTLEMENT`, `OTHER`.
- `PaymentDirection`: `OUTGOING`, `INCOMING`.
- `PaymentStatus`: `POSTED`, `VOID`.

Extended enums: `DocumentType.SALES_INVOICE`, `CostSourceType.GRN`,
`CostSourceType.BILL_VARIANCE`, `StockMovementType.SALE_OUT`.
`DocumentType.VENDOR_BILL` and `PAYMENT_REQUEST` already existed.
Legacy `CUSTOMER_INVOICE` remains for compatibility.

Exact fields for each new model, including relation fields:

- `VendorBill`: `id`, `organizationId`, `projectId`, `partyId`, `code`, `date`, `vendorInvoiceNo`, `vendorInvoiceDate`, `dueDate`, `purchaseOrderId`, `currency`, `subtotal`, `discountTotal`, `taxTotal`, `withholdingTotal`, `grandTotal`, `payableTotal`, `paidTotal`, `status`, `approvalRequestId`, `notes`, `createdById`, `organization`, `project`, `party`, `purchaseOrder`, `approvalRequest`, `createdBy`, `lines`, `paymentRequests`, `allocations`, `createdAt`, `updatedAt`.
- `VendorBillLine`: `id`, `billId`, `poLineId`, `grnLineId`, `itemVariantId`, `description`, `qty`, `uomId`, `rate`, `discountPercent`, `taxGroupId`, `lineSubtotal`, `lineTax`, `lineTotal`, `poRate`, `varianceAmount`, `bill`, `poLine`, `grnLine`, `variant`, `uom`, `taxGroup`, `taxes`, `createdAt`, `updatedAt`.
- `VendorBillLineTax`: `id`, `lineId`, `componentId`, `name`, `rate`, `amount`, `isWithholding`, `line`, `component`, `createdAt`, `updatedAt`.
- `PaymentRequest`: `id`, `organizationId`, `projectId`, `partyId`, `code`, `date`, `currency`, `amount`, `mode`, `purpose`, `requestedById`, `reason`, `status`, `approvalRequestId`, `organization`, `project`, `party`, `requestedBy`, `approvalRequest`, `bills`, `payments`, `createdAt`, `updatedAt`.
- `PaymentRequestBill`: `id`, `paymentRequestId`, `billId`, `amount`, `paymentRequest`, `bill`, `createdAt`, `updatedAt`.
- `Payment`: `id`, `organizationId`, `code`, `partyId`, `direction`, `date`, `mode`, `reference`, `currency`, `amount`, `allocatedAmount`, `unallocatedAmount`, `paymentRequestId`, `projectId`, `notes`, `status`, `createdById`, `organization`, `party`, `paymentRequest`, `project`, `createdBy`, `allocations`, `createdAt`, `updatedAt`.
- `PaymentAllocation`: `id`, `paymentId`, `vendorBillId`, `salesInvoiceId`, `amount`, `allocatedAt`, `allocatedById`, `payment`, `vendorBill`, `salesInvoice`, `allocatedBy`.
- `SalesInvoice`: `id`, `organizationId`, `projectId`, `partyId`, `code`, `date`, `dueDate`, `stateId`, `currency`, `subtotal`, `discountTotal`, `taxTotal`, `withholdingTotal`, `grandTotal`, `payableTotal`, `receivedTotal`, `status`, `approvalRequestId`, `notes`, `createdById`, `organization`, `project`, `party`, `placeOfSupply`, `approvalRequest`, `createdBy`, `lines`, `allocations`, `createdAt`, `updatedAt`.
- `SalesInvoiceLine`: `id`, `invoiceId`, `itemVariantId`, `description`, `qty`, `uomId`, `rate`, `discountPercent`, `taxGroupId`, `lineSubtotal`, `lineTax`, `lineTotal`, `fromProjectStock`, `stockMovementId`, `invoice`, `variant`, `uom`, `taxGroup`, `stockMovement`, `taxes`, `createdAt`, `updatedAt`.
- `SalesInvoiceLineTax`: `id`, `lineId`, `componentId`, `name`, `rate`, `amount`, `isWithholding`, `line`, `component`, `createdAt`, `updatedAt`.

Added inverse relations on existing models:

- `User`: `paymentRequestRows`, `paymentRows`, `paymentAllocationRows`, `vendorBillRows`, `salesInvoiceRows`.
- `Organization`: `vendorBillRows`, `paymentRequestRows`, `paymentRows`, `salesInvoiceRows`.
- `Project`: `vendorBillRows`, `paymentRequestRows`, `paymentRows`, `salesInvoiceRows`.
- `Party`: `vendorBillRows`, `paymentRequestRows`, `paymentRows`, `salesInvoiceRows`.
- `Uom`: `vendorBillLineRows`, `salesInvoiceLineRows`.
- `ItemVariant`: `vendorBillLineRows`, `salesInvoiceLineRows`.
- `TaxGroup`: `vendorBillLineRows`, `salesInvoiceLineRows`.
- `TaxComponent`: `vendorBillLineTaxRows`, `salesInvoiceLineTaxRows`.
- `ApprovalRequest`: `vendorBill`, `paymentRequest`, `salesInvoice`.
- `PurchaseOrder`: `vendorBillRows`.
- `PurchaseOrderLine`: `vendorBillLineRows`.
- `GoodsReceiptLine`: `vendorBillLineRows`.
- `State`: `salesInvoiceRows`.
- `StockMovement`: `salesInvoiceLine`.

Money is Decimal(18,2); quantities and rates are Decimal(18,4); discountPercent is
Decimal(7,4). Currency is required on bills, requests, payments and sales invoices.
Bill projectId is required; projectId is optional on requests, payments and sales invoices.
Bill vendorInvoiceNo/vendorInvoiceDate are required. dueDate and sales stateId are optional.
User actor keys are createdById, requestedById and allocatedById.
PaymentRequestBill is the requested-allocation child table, exposed as PaymentRequest.bills.
PaymentRequest.payments allows more than one payment; PAID is reserved for fulfillment.

Totals contract: subtotal is before document discounts; grandTotal = subtotal - discountTotal
+ taxTotal; payableTotal = grandTotal - withholdingTotal. lineSubtotal is the discounted taxable
base; lineTax excludes withholding; lineTotal = lineSubtotal + lineTax. Tax snapshots contain
withholding components separately. Bill poRate is nullable; varianceAmount is signed.
SQL checks enforce nonnegative money, positive quantities/allocations, bounded discounts/taxes,
payment split equality, settlement totals within payableTotal, and exactly one allocation target.
The existing stock_movement_sign check now permits negative SALE_OUT quantity/value.
SalesInvoiceLine.stockMovementId is optional and unique; it links one outgoing movement.
Cross-document org, party, currency and amount authorization remains a wave-2 service responsibility.

Vendor bill attachments use the existing polymorphic Attachment model:
entityType = "VendorBill", entityId = bill.id, organizationId = bill.organizationId.
There is no direct VendorBill.attachments Prisma relation.

## Shared module contract

- `src/server/bills/approval.ts`
- `src/server/payments/approval.ts` for PAYMENT_REQUEST, not Payment
- `src/server/sales/approval.ts`

Each exports `onApproved`, `onRejected`, `onCanceled` with the stable signature:

`(request: ApprovalRequest, tx: Prisma.TransactionClient, actorId: string) => Promise<void>`.

The registry imports each module namespace and registers VENDOR_BILL, PAYMENT_REQUEST,
and SALES_INVOICE. The stub guards id, organizationId, approvalRequestId and PENDING_APPROVAL,
then updates status to APPROVED, or DRAFT on rejection/cancellation, within the supplied tx.
No money, cost or stock effects. Each folder has a typed index.ts re-exporting these handlers.
Keep names/signatures stable when replacing bodies. Do not import approval service from handlers;
that service imports the registry and would introduce an import cycle.

`src/server/approvals/document-link.ts` adds the finance document routes and exports
`financeDocumentTitles` with VENDOR_BILL = "Vendor bill", PAYMENT_REQUEST = "Payment request",
SALES_INVOICE = "Sales invoice". Submission callers still store document-specific ApprovalRequest.title.

`src/server/procurement/cost-recognition.ts` exports:

`getProjectCostRecognition(tx: Prisma.TransactionClient, projectId: string): Promise<"ON_RECEIPT" | "ON_CONSUMPTION">`.

It reads the field with findUniqueOrThrow. Callers authorize the project first.
`MATERIAL_COST_RECOGNITION` in calculations.ts remains and is marked @deprecated.

## Routes and navigation

All placeholders check requireOrgContext inside an explicit Suspense boundary and show
existing PageHeading/Card components with "Coming soon". Loading files re-export the workspace skeleton.
Exact files under `src/app/(app)/[org]/`:

- `procurement/bills/page.tsx`
- `procurement/bills/loading.tsx`
- `procurement/bills/new/page.tsx`
- `procurement/bills/[billId]/page.tsx`
- `finance/payments/page.tsx`
- `finance/payments/loading.tsx`
- `finance/payments/new/page.tsx`
- `finance/payments/[id]/page.tsx`
- `finance/payment-requests/page.tsx`
- `finance/payment-requests/loading.tsx`
- `finance/payment-requests/new/page.tsx`
- `finance/payment-requests/[id]/page.tsx`
- `finance/balances/page.tsx`
- `finance/balances/loading.tsx`
- `sales/invoices/page.tsx`
- `sales/invoices/loading.tsx`
- `sales/invoices/new/page.tsx`
- `sales/invoices/[invoiceId]/page.tsx`
- `sales/receipts/page.tsx`
- `sales/receipts/loading.tsx`

Procurement gains Vendor bills, Payments and Payment requests. New Sales group contains
Invoices, Receipts and Balances. Links target the corresponding list routes above.

## Permissions

Added with labels: `bill.create`, `bill.view`, `payment.request.create`, `payment.record`,
`payment.view`, `sales.invoice.create`, `project.settings.manage`.
Existing `sales.view` is reused. Legacy bill.manage, payment.manage and sales.manage remain.

## Local database

The final, verified instance is `management-phase3b-shared`. Start/reuse it:

`pnpm prisma dev --name management-phase3b-shared --detach`

In PowerShell, for migrations only, set shell environment variables:

`$env:DATABASE_URL='postgres://postgres:postgres@localhost:51249/template1?sslmode=disable'`

`$env:PRISMA_SHADOW_DATABASE_URL='postgres://postgres:postgres@localhost:51250/template1?sslmode=disable'`

This URL uses the public schema and works with the existing PrismaPg adapter.
Always set the explicit shadow URL for migrate dev. For app runtime only DATABASE_URL is needed.
These are local Prisma dev credentials. .env was never edited; URLs were supplied only in shell env.
Use pnpm prisma dev ls if ports change after a restart.
The instance has all eight migrations, with no seed or retained smoke fixtures.

Recovery: initial management-phase3b returned P3005; an isolated schema attempt then hit a shadow
TenantStatus collision. Switched to fresh named instances with explicit shadow URLs.
Removed one newly generated empty migration, appended SQL checks to the one new finance migration,
and applied the final file to management-phase3b-shared. No prior migrations or application data reset.
The earlier throwaway instances are not the handoff database.

## Verification

- pnpm prisma validate: PASS.
- pnpm prisma generate: PASS; generated output ignored.
- pnpm prisma migrate dev --name phase3b_finance: PASS on final instance; repeat reported no drift.
- pnpm prisma migrate status: PASS, all eight migrations applied and schema up to date.
- pnpm exec tsc --noEmit: PASS.
- pnpm format: PASS.
- pnpm lint: PASS after organizing new imports/exports.
- pnpm test: PASS, 17/17 existing tests.
- pnpm build with placeholder DATABASE_URL: PASS, 58 static shells and all 14 new page routes.
- git diff --check: PASS.
- Transaction-isolated PostgreSQL smoke: PASS for inserts in all ten new models,
  default/override recognition, payable totals, payment split, allocation XOR, per-org unique codes,
  negative SALE_OUT signs, invoice stock link, line bounds and tax snapshots. Transaction rolled back.

Feature workflows, authentication/browser flows and concurrency are left for wave 2.
Only schema/shared setup is implemented. .env, src/generated and storage are excluded from the commit.
