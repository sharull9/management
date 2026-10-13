-- Phase 3c multi-currency foundation.
-- Safe on existing data: reference rows are created and enabled before any
-- foreign key is added, and every new base/original amount is backfilled with
-- rate 1 (existing documents are single-currency).

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "currencies_decimals_check" CHECK ("decimals" BETWEEN 0 AND 4)
);

-- CreateTable
CREATE TABLE "tenant_currencies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rateDate" DATE NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exchange_rates_rate_check" CHECK ("rate" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_currencies_tenantId_currencyCode_key" ON "tenant_currencies"("tenantId", "currencyCode");

-- CreateIndex
CREATE INDEX "exchange_rates_organizationId_rateDate_idx" ON "exchange_rates"("organizationId", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_organizationId_currencyCode_rateDate_key" ON "exchange_rates"("organizationId", "currencyCode", "rateDate");

-- Currencies that must exist before foreign keys: a baseline plus every code in use.
INSERT INTO "currencies" ("code", "name", "symbol", "decimals", "updatedAt") VALUES
  ('INR', 'Indian Rupee', '₹', 2, CURRENT_TIMESTAMP),
  ('USD', 'US Dollar', '$', 2, CURRENT_TIMESTAMP),
  ('EUR', 'Euro', '€', 2, CURRENT_TIMESTAMP),
  ('GBP', 'Pound Sterling', '£', 2, CURRENT_TIMESTAMP),
  ('AED', 'UAE Dirham', 'AED', 2, CURRENT_TIMESTAMP),
  ('SAR', 'Saudi Riyal', 'SAR', 2, CURRENT_TIMESTAMP),
  ('SGD', 'Singapore Dollar', 'S$', 2, CURRENT_TIMESTAMP),
  ('AUD', 'Australian Dollar', 'A$', 2, CURRENT_TIMESTAMP),
  ('CAD', 'Canadian Dollar', 'C$', 2, CURRENT_TIMESTAMP),
  ('JPY', 'Japanese Yen', '¥', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "currencies" ("code", "name", "symbol", "decimals", "updatedAt")
SELECT DISTINCT used."code", used."code", used."code", 2, CURRENT_TIMESTAMP
FROM (
  SELECT "baseCurrency" AS "code" FROM "organizations"
  UNION SELECT "currency" FROM "projects"
  UNION SELECT "currency" FROM "purchase_orders"
  UNION SELECT "currency" FROM "vendor_bills"
  UNION SELECT "currency" FROM "payment_requests"
  UNION SELECT "currency" FROM "payments"
  UNION SELECT "currency" FROM "sales_invoices"
) used
WHERE used."code" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;

-- Enable, per tenant, every currency its organizations already use.
INSERT INTO "tenant_currencies" ("id", "tenantId", "currencyCode", "enabled", "updatedAt")
SELECT gen_random_uuid()::text, used."tenantId", used."code", true, CURRENT_TIMESTAMP
FROM (
  SELECT o."tenantId", o."baseCurrency" AS "code" FROM "organizations" o
  UNION SELECT o."tenantId", p."currency" FROM "projects" p JOIN "organizations" o ON o."id" = p."organizationId"
  UNION SELECT o."tenantId", d."currency" FROM "purchase_orders" d JOIN "organizations" o ON o."id" = d."organizationId"
  UNION SELECT o."tenantId", d."currency" FROM "vendor_bills" d JOIN "organizations" o ON o."id" = d."organizationId"
  UNION SELECT o."tenantId", d."currency" FROM "payment_requests" d JOIN "organizations" o ON o."id" = d."organizationId"
  UNION SELECT o."tenantId", d."currency" FROM "payments" d JOIN "organizations" o ON o."id" = d."organizationId"
  UNION SELECT o."tenantId", d."currency" FROM "sales_invoices" d JOIN "organizations" o ON o."id" = d."organizationId"
) used
WHERE used."code" IS NOT NULL
ON CONFLICT ("tenantId", "currencyCode") DO NOTHING;

-- AlterTable: columns first, then backfill, then constraints.
ALTER TABLE "cost_entries"
  ADD COLUMN "originalCurrency" TEXT,
  ADD COLUMN "originalAmount" DECIMAL(18,2),
  ADD COLUMN "baseAmount" DECIMAL(18,2),
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "projectRate" DECIMAL(20,10) NOT NULL DEFAULT 1;

ALTER TABLE "expenses"
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "goods_receipts"
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1;

ALTER TABLE "parties" ADD COLUMN "defaultCurrency" TEXT;

ALTER TABLE "payment_allocations"
  ADD COLUMN "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "documentBaseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fxDifference" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "payment_requests"
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "payments"
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "purchase_orders"
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "baseSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseTaxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseWithholdingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseGrandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "sales_invoices"
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "baseSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseDiscountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseTaxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseWithholdingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseGrandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "basePayableTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "vendor_bills"
  ADD COLUMN "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "baseSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseDiscountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseTaxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseWithholdingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "baseGrandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "basePayableTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Backfill: every existing document is single-currency, so rate = 1 and base = original.
UPDATE "cost_entries" c SET
  "originalCurrency" = p."currency",
  "originalAmount" = c."amount",
  "baseAmount" = c."amount"
FROM "projects" p WHERE p."id" = c."projectId";

UPDATE "expenses" e SET "currency" = p."currency", "baseAmount" = e."amount"
FROM "projects" p WHERE p."id" = e."projectId";

UPDATE "goods_receipts" g SET "currency" = po."currency"
FROM "purchase_orders" po WHERE po."id" = g."poId";

UPDATE "purchase_orders" SET
  "baseSubtotal" = "subtotal", "baseTaxTotal" = "taxTotal",
  "baseWithholdingTotal" = "withholdingTotal", "baseGrandTotal" = "grandTotal";

UPDATE "vendor_bills" SET
  "baseSubtotal" = "subtotal", "baseDiscountTotal" = "discountTotal",
  "baseTaxTotal" = "taxTotal", "baseWithholdingTotal" = "withholdingTotal",
  "baseGrandTotal" = "grandTotal", "basePayableTotal" = "payableTotal";

UPDATE "sales_invoices" SET
  "baseSubtotal" = "subtotal", "baseDiscountTotal" = "discountTotal",
  "baseTaxTotal" = "taxTotal", "baseWithholdingTotal" = "withholdingTotal",
  "baseGrandTotal" = "grandTotal", "basePayableTotal" = "payableTotal";

UPDATE "payment_requests" SET "baseAmount" = "amount";
UPDATE "payments" SET "baseAmount" = "amount";
UPDATE "payment_allocations" SET
  "baseAmount" = "amount", "documentBaseAmount" = "amount", "fxDifference" = 0;

ALTER TABLE "cost_entries"
  ALTER COLUMN "originalCurrency" SET NOT NULL,
  ALTER COLUMN "originalAmount" SET NOT NULL,
  ALTER COLUMN "baseAmount" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "goods_receipts" ALTER COLUMN "currency" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_baseCurrency_fkey" FOREIGN KEY ("baseCurrency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parties" ADD CONSTRAINT "parties_defaultCurrency_fkey" FOREIGN KEY ("defaultCurrency") REFERENCES "currencies"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_originalCurrency_fkey" FOREIGN KEY ("originalCurrency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_currencies" ADD CONSTRAINT "tenant_currencies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_currencies" ADD CONSTRAINT "tenant_currencies_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rates must be positive. Cost signs keep the existing rule (negative only for
-- MATERIAL TRANSFER / BILL_VARIANCE) and now cover the original and base amounts
-- consistently: all three amounts are nonnegative, or all three are nonpositive
-- for those sources.
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entry_rates_positive" CHECK ("exchangeRate" > 0 AND "projectRate" > 0);
ALTER TABLE "cost_entries" DROP CONSTRAINT cost_entry_amount;
ALTER TABLE "cost_entries" ADD CONSTRAINT cost_entry_amount CHECK (
  (amount >= 0 AND "originalAmount" >= 0 AND "baseAmount" >= 0) OR (
    "costType" = 'MATERIAL' AND "sourceType" IN ('TRANSFER', 'BILL_VARIANCE')
    AND amount <= 0 AND "originalAmount" <= 0 AND "baseAmount" <= 0
  )
);
