import assert from "node:assert/strict";
import test from "node:test";
import type { OrgContext } from "@/core/context";

import { expectAssetFailure, withAssetTestDatabase } from "./test-database";

test(
  "asset services enforce registry, logging, ledger, and rollback invariants",
  { skip: process.env.ASSETS_DB_TEST !== "local-only" },
  async () => {
    await withAssetTestDatabase(async (tx) => {
      const { saveAsset, saveAllocation } = await import("./registry-service");
      const { saveTrip, saveUsage, saveFuelLog, deleteLog } = await import(
        "./log-service"
      );
      const { calculateFuelEfficiency } = await import("../util");
      const token = `asset-test-${crypto.randomUUID()}`;
      const tenant = await tx.tenant.create({
        data: { name: token, slug: token },
      });
      const org = await tx.organization.create({
        data: { name: token, slug: token, tenantId: tenant.id },
      });
      const user = await tx.user.create({
        data: { name: token, email: `${token}@example.test` },
      });
      const project = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "P1",
          name: "Project",
          currency: "INR",
        },
      });
      const otherProject = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "P2",
          name: "Other",
          currency: "INR",
        },
      });
      const ctx = {
        org,
        tenant,
        user,
        isAdmin: true,
        permissions: new Set<string>(),
        member: null,
        tenantRole: "OWNER",
      } as unknown as OrgContext;
      const km = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "Truck",
        code: "T1",
        active: true,
        equipmentRatePerMeter: "2",
      });
      const allocation = await saveAllocation(tx, ctx, {
        assetId: km.id,
        projectId: project.id,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      });
      await expectAssetFailure(tx, () =>
        saveAllocation(tx, ctx, {
          assetId: km.id,
          projectId: otherProject.id,
          startDate: "2026-12-31",
          endDate: null,
        }),
      );
      const projectCtx = { ...ctx, project } as OrgContext;
      await expectAssetFailure(tx, () =>
        saveAllocation(tx, projectCtx, {
          assetId: km.id,
          projectId: otherProject.id,
          startDate: "2026-01-01",
          endDate: null,
        }),
      );
      const readonly = {
        ...ctx,
        isAdmin: false,
        permissions: new Set(["asset.log"]),
      } as OrgContext;
      const tripInput = {
        assetId: km.id,
        allocationId: allocation.id,
        projectId: project.id,
        outAt: "2026-02-01T08:00:00.000Z",
        inAt: "2026-02-01T10:00:00.000Z",
        startReading: "10",
        endReading: "20",
      };
      await expectAssetFailure(tx, () => saveTrip(tx, readonly, tripInput));
      const trip = await saveTrip(tx, ctx, tripInput);
      await saveAsset(tx, ctx, {
        id: km.id,
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "Truck",
        code: "T1",
        active: true,
        equipmentRatePerMeter: "9",
      });
      const editedTrip = await saveTrip(tx, ctx, {
        ...tripInput,
        id: trip.id,
        endAt: undefined,
        endReading: "21",
      });
      assert.equal(editedTrip.equipmentRateSnapshot.toFixed(2), "2.00");
      assert.equal(editedTrip.equipmentCost.toFixed(2), "22.00");
      const tripCosts = await tx.costEntry.findMany({
        where: {
          organizationId: org.id,
          sourceType: "ASSET_TRIP",
          sourceId: trip.id,
        },
      });
      assert.equal(tripCosts.length, 1);
      assert.equal(tripCosts[0].originalAmount.toFixed(2), "22.00");
      assert.equal(tripCosts[0].baseAmount.toFixed(2), "22.00");
      assert.equal(tripCosts[0].amount.toFixed(2), "22.00");
      assert.equal(tripCosts[0].projectId, project.id);

      const inactive = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "PETROL",
        name: "Inactive",
        code: "I1",
        active: false,
        equipmentRatePerMeter: "1",
      });
      const inactiveAllocation = await saveAllocation(tx, ctx, {
        assetId: inactive.id,
        projectId: project.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      await expectAssetFailure(tx, () =>
        saveTrip(tx, ctx, {
          ...tripInput,
          assetId: inactive.id,
          allocationId: inactiveAllocation.id,
        }),
      );
      await expectAssetFailure(tx, () =>
        saveUsage(tx, ctx, {
          assetId: km.id,
          allocationId: allocation.id,
          projectId: project.id,
          startAt: "2026-03-01T08:00:00Z",
          endAt: "2026-03-01T09:00:00Z",
          startReading: "20",
          endReading: "21",
        }),
      );

      const electric = await saveAsset(tx, ctx, {
        type: "MACHINE",
        meterType: "HOURS",
        powerType: "ELECTRIC",
        name: "Excavator",
        code: "E1",
        active: true,
        equipmentRatePerMeter: "5",
        powerRatingKw: "10",
        electricityTariff: "3",
      });
      const electricAllocation = await saveAllocation(tx, ctx, {
        assetId: electric.id,
        projectId: project.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      const usageInput = {
        assetId: electric.id,
        allocationId: electricAllocation.id,
        projectId: project.id,
        startAt: "2026-04-01T08:00:00Z",
        endAt: "2026-04-01T10:30:00Z",
        startReading: "0",
        endReading: "2.5",
      };
      const usage = await saveUsage(tx, ctx, usageInput);
      assert.equal(usage.equipmentCost.toFixed(2), "12.50");
      assert.equal(usage.electricityKwh?.toFixed(4), "25.0000");
      assert.equal(usage.electricityCost?.toFixed(2), "75.00");
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, sourceId: usage.id },
        }),
        2,
      );
      await saveUsage(tx, ctx, {
        ...usageInput,
        id: usage.id,
        endAt: "2026-04-01T11:00:00Z",
        endReading: "3",
      });
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, sourceId: usage.id },
        }),
        2,
      );
      assert.equal(
        await tx.costEntry.count({
          where: {
            organizationId: org.id,
            sourceType: "ASSET_ELECTRICITY",
            sourceId: usage.id,
          },
        }),
        1,
      );
      await deleteLog(tx, ctx, { kind: "USAGE", id: usage.id });
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, sourceId: usage.id },
        }),
        0,
      );
      await deleteLog(tx, ctx, { kind: "TRIP", id: trip.id });
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, sourceId: trip.id },
        }),
        0,
      );

      const fuelAsset = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "Van",
        code: "V1",
        active: true,
        equipmentRatePerMeter: "0",
      });
      const fuelAllocation = await saveAllocation(tx, ctx, {
        assetId: fuelAsset.id,
        projectId: project.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      await saveFuelLog(tx, ctx, {
        assetId: fuelAsset.id,
        allocationId: fuelAllocation.id,
        projectId: project.id,
        date: "2026-05-01",
        quantityLitres: "10",
        totalCost: "100",
        meterReading: "100",
      });
      const second = await saveFuelLog(tx, ctx, {
        assetId: fuelAsset.id,
        allocationId: fuelAllocation.id,
        projectId: project.id,
        date: "2026-05-02",
        quantityLitres: "10",
        totalCost: "110",
        meterReading: "200",
      });
      await saveFuelLog(tx, ctx, {
        id: second.id,
        assetId: fuelAsset.id,
        allocationId: fuelAllocation.id,
        projectId: project.id,
        date: "2026-05-02",
        quantityLitres: "20",
        totalCost: "220",
        meterReading: "200",
      });
      assert.equal(
        calculateFuelEfficiency({
          meterType: "KM",
          previousReading: "100",
          currentReading: "200",
          quantityLitres: "20",
        }).value?.toFixed(4),
        "5.0000",
      );
      await deleteLog(tx, ctx, { kind: "FUEL", id: second.id });
      assert.equal(
        await tx.costEntry.count({
          where: {
            organizationId: org.id,
            sourceType: "ASSET_FUEL",
            sourceId: second.id,
          },
        }),
        0,
      );
      const fxProject = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "FX",
          name: "FX missing",
          currency: "USD",
        },
      });
      const fxAsset = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "FX van",
        code: "FX1",
        active: true,
        equipmentRatePerMeter: "0",
      });
      const fxAllocation = await saveAllocation(tx, ctx, {
        assetId: fxAsset.id,
        projectId: fxProject.id,
        startDate: "2026-06-01",
        endDate: null,
      });
      await expectAssetFailure(tx, () =>
        saveFuelLog(tx, ctx, {
          assetId: fxAsset.id,
          allocationId: fxAllocation.id,
          projectId: fxProject.id,
          date: "2026-06-02",
          quantityLitres: "1",
          totalCost: "5",
          meterReading: "300",
        }),
      );
      assert.equal(
        await tx.assetFuelLog.count({
          where: {
            organizationId: org.id,
            allocationId: fxAllocation.id,
          },
        }),
        0,
      );
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, projectId: fxProject.id },
        }),
        0,
      );
    });
  },
);
