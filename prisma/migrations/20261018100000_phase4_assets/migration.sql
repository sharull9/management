-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VEHICLE', 'MACHINE');

-- CreateEnum
CREATE TYPE "AssetMeterType" AS ENUM ('KM', 'HOURS');

-- CreateEnum
CREATE TYPE "AssetPowerType" AS ENUM ('DIESEL', 'PETROL', 'ELECTRIC', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CostSourceType" ADD VALUE 'ASSET_TRIP';
ALTER TYPE "CostSourceType" ADD VALUE 'ASSET_USAGE';
ALTER TYPE "CostSourceType" ADD VALUE 'ASSET_ELECTRICITY';
ALTER TYPE "CostSourceType" ADD VALUE 'ASSET_FUEL';

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "meterType" "AssetMeterType" NOT NULL,
    "powerType" "AssetPowerType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "equipmentRatePerMeter" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "powerRatingKw" DECIMAL(18,4),
    "electricityTariff" DECIMAL(18,2),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_allocations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_trips" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outAt" TIMESTAMP(3) NOT NULL,
    "inAt" TIMESTAMP(3) NOT NULL,
    "startReading" DECIMAL(18,4) NOT NULL,
    "endReading" DECIMAL(18,4) NOT NULL,
    "equipmentRateSnapshot" DECIMAL(18,2) NOT NULL,
    "equipmentCost" DECIMAL(18,2) NOT NULL,
    "powerRatingKwSnapshot" DECIMAL(18,4),
    "electricityTariffSnapshot" DECIMAL(18,2),
    "electricityKwh" DECIMAL(18,4),
    "electricityCost" DECIMAL(18,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_usages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "startReading" DECIMAL(18,4) NOT NULL,
    "endReading" DECIMAL(18,4) NOT NULL,
    "equipmentRateSnapshot" DECIMAL(18,2) NOT NULL,
    "equipmentCost" DECIMAL(18,2) NOT NULL,
    "powerRatingKwSnapshot" DECIMAL(18,4),
    "electricityTariffSnapshot" DECIMAL(18,2),
    "electricityKwh" DECIMAL(18,4),
    "electricityCost" DECIMAL(18,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_fuel_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantityLitres" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "meterReading" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_organizationId_active_name_idx" ON "assets"("organizationId", "active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "assets_organizationId_code_key" ON "assets"("organizationId", "code");

-- CreateIndex
CREATE INDEX "asset_allocations_organizationId_projectId_startDate_idx" ON "asset_allocations"("organizationId", "projectId", "startDate");

-- CreateIndex
CREATE INDEX "asset_allocations_assetId_startDate_endDate_idx" ON "asset_allocations"("assetId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "asset_trips_organizationId_projectId_outAt_idx" ON "asset_trips"("organizationId", "projectId", "outAt");

-- CreateIndex
CREATE INDEX "asset_trips_assetId_outAt_idx" ON "asset_trips"("assetId", "outAt");

-- CreateIndex
CREATE INDEX "asset_usages_organizationId_projectId_startAt_idx" ON "asset_usages"("organizationId", "projectId", "startAt");

-- CreateIndex
CREATE INDEX "asset_usages_assetId_startAt_idx" ON "asset_usages"("assetId", "startAt");

-- CreateIndex
CREATE INDEX "asset_fuel_logs_organizationId_projectId_date_idx" ON "asset_fuel_logs"("organizationId", "projectId", "date");

-- CreateIndex
CREATE INDEX "asset_fuel_logs_assetId_date_meterReading_idx" ON "asset_fuel_logs"("assetId", "date", "meterReading");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trips" ADD CONSTRAINT "asset_trips_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trips" ADD CONSTRAINT "asset_trips_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trips" ADD CONSTRAINT "asset_trips_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "asset_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trips" ADD CONSTRAINT "asset_trips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trips" ADD CONSTRAINT "asset_trips_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "asset_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_fuel_logs" ADD CONSTRAINT "asset_fuel_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_fuel_logs" ADD CONSTRAINT "asset_fuel_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_fuel_logs" ADD CONSTRAINT "asset_fuel_logs_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "asset_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_fuel_logs" ADD CONSTRAINT "asset_fuel_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_fuel_logs" ADD CONSTRAINT "asset_fuel_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep invalid numeric states out even when a writer bypasses the pure module schemas.
ALTER TABLE "assets" ADD CONSTRAINT "assets_nonnegative_equipment_rate_check" CHECK ("equipmentRatePerMeter" >= 0);
ALTER TABLE "assets" ADD CONSTRAINT "assets_power_configuration_check" CHECK (
  ("powerType" = 'ELECTRIC' AND "powerRatingKw" IS NOT NULL AND "powerRatingKw" > 0 AND "electricityTariff" IS NOT NULL AND "electricityTariff" >= 0)
  OR ("powerType" <> 'ELECTRIC' AND "powerRatingKw" IS NULL AND "electricityTariff" IS NULL)
);
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_date_order_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "asset_trips" ADD CONSTRAINT "asset_trips_values_check" CHECK (
  "inAt" >= "outAt" AND "startReading" >= 0 AND "endReading" >= "startReading"
  AND "equipmentRateSnapshot" >= 0 AND "equipmentCost" >= 0
  AND (("powerRatingKwSnapshot" IS NULL AND "electricityTariffSnapshot" IS NULL AND "electricityKwh" IS NULL AND "electricityCost" IS NULL)
    OR ("powerRatingKwSnapshot" IS NOT NULL AND "powerRatingKwSnapshot" > 0 AND "electricityTariffSnapshot" IS NOT NULL AND "electricityTariffSnapshot" >= 0 AND "electricityKwh" IS NOT NULL AND "electricityKwh" >= 0 AND "electricityCost" IS NOT NULL AND "electricityCost" >= 0))
);
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_values_check" CHECK (
  "endAt" > "startAt" AND "startReading" >= 0 AND "endReading" >= "startReading"
  AND "equipmentRateSnapshot" >= 0 AND "equipmentCost" >= 0
  AND (("powerRatingKwSnapshot" IS NULL AND "electricityTariffSnapshot" IS NULL AND "electricityKwh" IS NULL AND "electricityCost" IS NULL)
    OR ("powerRatingKwSnapshot" IS NOT NULL AND "powerRatingKwSnapshot" > 0 AND "electricityTariffSnapshot" IS NOT NULL AND "electricityTariffSnapshot" >= 0 AND "electricityKwh" IS NOT NULL AND "electricityKwh" >= 0 AND "electricityCost" IS NOT NULL AND "electricityCost" >= 0))
);
ALTER TABLE "asset_fuel_logs" ADD CONSTRAINT "asset_fuel_logs_values_check" CHECK (
  "quantityLitres" > 0 AND "totalCost" >= 0 AND "meterReading" >= 0
);

-- Serialize allocation checks per asset so concurrent inserts cannot overlap.
CREATE FUNCTION "check_asset_allocation_overlap"() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."assetId"));
  IF EXISTS (
    SELECT 1 FROM "asset_allocations" AS existing
    WHERE existing."assetId" = NEW."assetId"
      AND existing."id" <> NEW."id"
      AND (existing."endDate" IS NULL OR existing."endDate" >= NEW."startDate")
      AND (NEW."endDate" IS NULL OR existing."startDate" <= NEW."endDate")
  ) THEN
    RAISE EXCEPTION 'Asset allocation dates cannot overlap for asset %', NEW."assetId"
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "asset_allocation_no_overlap"
BEFORE INSERT OR UPDATE
ON "asset_allocations"
FOR EACH ROW EXECUTE FUNCTION "check_asset_allocation_overlap"();
