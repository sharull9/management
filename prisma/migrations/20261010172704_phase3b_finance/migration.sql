-- CreateEnum
CREATE TYPE "MaterialCostRecognition" AS ENUM ('ON_RECEIPT', 'ON_CONSUMPTION');

-- CreateEnum
CREATE TYPE "FinanceDocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK', 'UPI', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ADVANCE', 'BILL_SETTLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CostSourceType" ADD VALUE 'GRN';
ALTER TYPE "CostSourceType" ADD VALUE 'BILL_VARIANCE';

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'SALES_INVOICE';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'SALE_OUT';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "materialCostRecognition" "MaterialCostRecognition" NOT NULL DEFAULT 'ON_CONSUMPTION';

-- CreateTable
CREATE TABLE "vendor_bills" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorInvoiceNo" TEXT NOT NULL,
    "vendorInvoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "purchaseOrderId" TEXT,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL,
    "withholdingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "payableTotal" DECIMAL(18,2) NOT NULL,
    "paidTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "FinanceDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalRequestId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bill_lines" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "poLineId" TEXT,
    "grnLineId" TEXT,
    "itemVariantId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "uomId" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxGroupId" TEXT,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTax" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "poRate" DECIMAL(18,4),
    "varianceAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bill_line_taxes" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "isWithholding" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bill_line_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "partyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_request_bills" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_request_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "date" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "allocatedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(18,2) NOT NULL,
    "paymentRequestId" TEXT,
    "projectId" TEXT,
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "vendorBillId" TEXT,
    "salesInvoiceId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedById" TEXT NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "partyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "stateId" TEXT,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL,
    "withholdingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "payableTotal" DECIMAL(18,2) NOT NULL,
    "receivedTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "FinanceDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalRequestId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemVariantId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "uomId" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxGroupId" TEXT,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTax" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "fromProjectStock" BOOLEAN NOT NULL DEFAULT false,
    "stockMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_line_taxes" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "isWithholding" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoice_line_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bills_approvalRequestId_key" ON "vendor_bills"("approvalRequestId");

-- CreateIndex
CREATE INDEX "vendor_bills_organizationId_partyId_status_date_idx" ON "vendor_bills"("organizationId", "partyId", "status", "date");

-- CreateIndex
CREATE INDEX "vendor_bills_organizationId_status_date_idx" ON "vendor_bills"("organizationId", "status", "date");

-- CreateIndex
CREATE INDEX "vendor_bills_projectId_status_idx" ON "vendor_bills"("projectId", "status");

-- CreateIndex
CREATE INDEX "vendor_bills_purchaseOrderId_idx" ON "vendor_bills"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bills_organizationId_code_key" ON "vendor_bills"("organizationId", "code");

-- CreateIndex
CREATE INDEX "vendor_bill_lines_billId_idx" ON "vendor_bill_lines"("billId");

-- CreateIndex
CREATE INDEX "vendor_bill_lines_poLineId_idx" ON "vendor_bill_lines"("poLineId");

-- CreateIndex
CREATE INDEX "vendor_bill_lines_grnLineId_idx" ON "vendor_bill_lines"("grnLineId");

-- CreateIndex
CREATE INDEX "vendor_bill_line_taxes_lineId_idx" ON "vendor_bill_line_taxes"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_approvalRequestId_key" ON "payment_requests"("approvalRequestId");

-- CreateIndex
CREATE INDEX "payment_requests_organizationId_partyId_status_date_idx" ON "payment_requests"("organizationId", "partyId", "status", "date");

-- CreateIndex
CREATE INDEX "payment_requests_organizationId_status_date_idx" ON "payment_requests"("organizationId", "status", "date");

-- CreateIndex
CREATE INDEX "payment_requests_projectId_status_idx" ON "payment_requests"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_organizationId_code_key" ON "payment_requests"("organizationId", "code");

-- CreateIndex
CREATE INDEX "payment_request_bills_billId_idx" ON "payment_request_bills"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_request_bills_paymentRequestId_billId_key" ON "payment_request_bills"("paymentRequestId", "billId");

-- CreateIndex
CREATE INDEX "payments_organizationId_partyId_status_date_idx" ON "payments"("organizationId", "partyId", "status", "date");

-- CreateIndex
CREATE INDEX "payments_organizationId_status_date_idx" ON "payments"("organizationId", "status", "date");

-- CreateIndex
CREATE INDEX "payments_organizationId_direction_date_idx" ON "payments"("organizationId", "direction", "date");

-- CreateIndex
CREATE INDEX "payments_paymentRequestId_idx" ON "payments"("paymentRequestId");

-- CreateIndex
CREATE INDEX "payments_projectId_idx" ON "payments"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organizationId_code_key" ON "payments"("organizationId", "code");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_vendorBillId_idx" ON "payment_allocations"("vendorBillId");

-- CreateIndex
CREATE INDEX "payment_allocations_salesInvoiceId_idx" ON "payment_allocations"("salesInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_approvalRequestId_key" ON "sales_invoices"("approvalRequestId");

-- CreateIndex
CREATE INDEX "sales_invoices_organizationId_partyId_status_date_idx" ON "sales_invoices"("organizationId", "partyId", "status", "date");

-- CreateIndex
CREATE INDEX "sales_invoices_organizationId_status_date_idx" ON "sales_invoices"("organizationId", "status", "date");

-- CreateIndex
CREATE INDEX "sales_invoices_projectId_status_idx" ON "sales_invoices"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_organizationId_code_key" ON "sales_invoices"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_lines_stockMovementId_key" ON "sales_invoice_lines"("stockMovementId");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_invoiceId_idx" ON "sales_invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "sales_invoice_line_taxes_lineId_idx" ON "sales_invoice_line_taxes"("lineId");

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_billId_fkey" FOREIGN KEY ("billId") REFERENCES "vendor_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_grnLineId_fkey" FOREIGN KEY ("grnLineId") REFERENCES "goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_itemVariantId_fkey" FOREIGN KEY ("itemVariantId") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line_taxes" ADD CONSTRAINT "vendor_bill_line_taxes_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "vendor_bill_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line_taxes" ADD CONSTRAINT "vendor_bill_line_taxes_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "tax_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_bills" ADD CONSTRAINT "payment_request_bills_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_bills" ADD CONSTRAINT "payment_request_bills_billId_fkey" FOREIGN KEY ("billId") REFERENCES "vendor_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "vendor_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_itemVariantId_fkey" FOREIGN KEY ("itemVariantId") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "tax_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_line_taxes" ADD CONSTRAINT "sales_invoice_line_taxes_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "sales_invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_line_taxes" ADD CONSTRAINT "sales_invoice_line_taxes_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "tax_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Finance integrity rules. Cross-document org/party/currency checks belong in wave-2 services.
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocation_target_xor CHECK (("vendorBillId" IS NOT NULL) <> ("salesInvoiceId" IS NOT NULL));
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocation_positive CHECK (amount > 0);
ALTER TABLE payment_request_bills ADD CONSTRAINT payment_request_bill_positive CHECK (amount > 0);
ALTER TABLE payment_requests ADD CONSTRAINT payment_request_positive CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT payment_amount_split CHECK (amount > 0 AND "allocatedAmount" >= 0 AND "unallocatedAmount" >= 0 AND amount = "allocatedAmount" + "unallocatedAmount");
-- Subtotal is before document discounts; lineSubtotal is the discounted taxable line base.
ALTER TABLE vendor_bills ADD CONSTRAINT bill_amounts CHECK (subtotal >= 0 AND "discountTotal" BETWEEN 0 AND subtotal AND "taxTotal" >= 0 AND "withholdingTotal" >= 0 AND "grandTotal" = subtotal - "discountTotal" + "taxTotal" AND "payableTotal" = "grandTotal" - "withholdingTotal" AND "payableTotal" >= 0 AND "paidTotal" BETWEEN 0 AND "payableTotal");
ALTER TABLE sales_invoices ADD CONSTRAINT invoice_amounts CHECK (subtotal >= 0 AND "discountTotal" BETWEEN 0 AND subtotal AND "taxTotal" >= 0 AND "withholdingTotal" >= 0 AND "grandTotal" = subtotal - "discountTotal" + "taxTotal" AND "payableTotal" = "grandTotal" - "withholdingTotal" AND "payableTotal" >= 0 AND "receivedTotal" BETWEEN 0 AND "payableTotal");
ALTER TABLE vendor_bill_lines ADD CONSTRAINT bill_line_amounts CHECK (qty > 0 AND rate >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND "lineSubtotal" >= 0 AND "lineTax" >= 0 AND "lineTotal" = "lineSubtotal" + "lineTax" AND ("poRate" IS NULL OR "poRate" >= 0));
ALTER TABLE sales_invoice_lines ADD CONSTRAINT invoice_line_amounts CHECK (qty > 0 AND rate >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND "lineSubtotal" >= 0 AND "lineTax" >= 0 AND "lineTotal" = "lineSubtotal" + "lineTax");
ALTER TABLE vendor_bill_line_taxes ADD CONSTRAINT bill_tax_amounts CHECK (rate BETWEEN 0 AND 100 AND amount >= 0);
ALTER TABLE sales_invoice_line_taxes ADD CONSTRAINT invoice_tax_amounts CHECK (rate BETWEEN 0 AND 100 AND amount >= 0);
-- Preserve the existing signs and include outgoing sales stock.
ALTER TABLE stock_movements DROP CONSTRAINT stock_movement_sign;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movement_sign CHECK ("unitCost" >= 0 AND ((type::text IN ('GRN_IN','TRANSFER_IN') AND qty > 0 AND "totalCost" >= 0) OR (type::text IN ('CONSUMPTION_OUT','TRANSFER_OUT','SALE_OUT') AND qty < 0 AND "totalCost" <= 0) OR type::text = 'ADJUSTMENT'));
