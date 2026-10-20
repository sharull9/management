import assert from "node:assert/strict";
import test from "node:test";
import type { OrgContext } from "@/core/context";

import { expectAssetFailure, withAssetTestDatabase } from "./test-database";

test(
  "asset services enforce scope and currency conversion invariants",
  { skip: process.env.ASSETS_DB_TEST !== "local-only" },
  async () => {
    await withAssetTestDatabase(async (tx) => {
      const { saveAsset, saveAllocation } = await import("./registry-service");
      const { saveTrip, saveFuelLog, deleteLog } = await import(
        "./log-service"
      );
      const token = `asset-scope-${crypto.randomUUID()}`;
      const tenant = await tx.tenant.create({
        data: { name: token, slug: token },
      });
      const org = await tx.organization.create({
        data: { name: token, slug: token, tenantId: tenant.id },
      });
      const secondOrg = await tx.organization.create({
        data: {
          name: `${token}-other`,
          slug: `${token}-other`,
          tenantId: tenant.id,
        },
      });
      const user = await tx.user.create({
        data: { name: token, email: `${token}@example.test` },
      });
      const project = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "P1",
          name: "INR",
          currency: "INR",
        },
      });
      const usd = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "USD",
          name: "USD",
          currency: "USD",
        },
      });
      const gbp = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "GBP",
          name: "GBP without a rate",
          currency: "GBP",
        },
      });
      const foreignProject = await tx.project.create({
        data: {
          organizationId: secondOrg.id,
          code: "F1",
          name: "Foreign",
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
      const otherOrgCtx = { ...ctx, org: secondOrg } as OrgContext;
      const scoped = { ...ctx, project: usd } as OrgContext;
      const asset = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "Van",
        code: "V1",
        active: true,
        equipmentRatePerMeter: "2",
      });
      const allocation = await saveAllocation(tx, ctx, {
        assetId: asset.id,
        projectId: project.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      await expectAssetFailure(
        tx,
        () =>
          saveAllocation(tx, otherOrgCtx, {
            assetId: asset.id,
            projectId: foreignProject.id,
            startDate: "2026-01-01",
            endDate: null,
          }),
        /Asset not found/,
      );
      const tripInput = {
        assetId: asset.id,
        allocationId: allocation.id,
        projectId: project.id,
        outAt: "2026-02-01T08:00:00Z",
        inAt: "2026-02-01T09:00:00Z",
        startReading: "0",
        endReading: "1",
      };
      const readonly = {
        ...ctx,
        isAdmin: false,
        permissions: new Set(["asset.view"]),
      } as OrgContext;
      await expectAssetFailure(
        tx,
        () => saveTrip(tx, readonly, tripInput),
        /do not have permission/i,
      );
      const nonmember = {
        ...ctx,
        member: null,
        isAdmin: false,
        permissions: new Set(["asset.log"]),
      } as OrgContext;
      await expectAssetFailure(
        tx,
        () => saveTrip(tx, nonmember, tripInput),
        /project|access/i,
      );
      const trip = await saveTrip(tx, ctx, tripInput);
      await expectAssetFailure(
        tx,
        () => saveTrip(tx, scoped, tripInput),
        /access to this project|project/i,
      );
      await expectAssetFailure(
        tx,
        () => deleteLog(tx, scoped, { kind: "TRIP", id: trip.id }),
        /access to this project|project/i,
      );
      assert.equal(await tx.assetTrip.count({ where: { id: trip.id } }), 1);

      await tx.exchangeRate.create({
        data: {
          organizationId: org.id,
          currencyCode: "USD",
          rateDate: new Date("2026-01-01T00:00:00Z"),
          rate: "83",
          createdById: user.id,
        },
      });
      const usdAsset = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "USD Van",
        code: "V2",
        active: true,
        equipmentRatePerMeter: "166",
      });
      const usdAllocation = await saveAllocation(tx, ctx, {
        assetId: usdAsset.id,
        projectId: usd.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      const usdTripInput = {
        ...tripInput,
        assetId: usdAsset.id,
        allocationId: usdAllocation.id,
        projectId: usd.id,
        outAt: "2026-03-01T08:00:00Z",
        inAt: "2026-03-01T09:00:00Z",
        endReading: "1",
      };
      const usdTrip = await saveTrip(tx, ctx, usdTripInput);
      assert.equal(usdTrip.equipmentCost.toFixed(2), "166.00");
      const usdCost = await tx.costEntry.findFirst({
        where: {
          organizationId: org.id,
          sourceId: usdTrip.id,
          sourceType: "ASSET_TRIP",
        },
      });
      assert.ok(usdCost);
      assert.equal(usdCost.originalAmount.toFixed(2), "166.00");
      assert.equal(usdCost.baseAmount.toFixed(2), "166.00");
      assert.equal(usdCost.amount.toFixed(2), "2.00");
      await saveTrip(tx, ctx, {
        ...usdTripInput,
        id: usdTrip.id,
        endAt: undefined,
        endReading: "2",
      });
      const editedCost = await tx.costEntry.findFirst({
        where: {
          organizationId: org.id,
          sourceId: usdTrip.id,
          sourceType: "ASSET_TRIP",
        },
      });
      assert.equal(editedCost?.amount.toFixed(2), "4.00");
      const editedUsd = await tx.assetTrip.findUniqueOrThrow({
        where: { id: usdTrip.id },
      });
      assert.equal(editedUsd.equipmentRateSnapshot.toFixed(2), "166.00");
      await expectAssetFailure(
        tx,
        () => saveTrip(tx, otherOrgCtx, tripInput),
        /not found|organization|access to this project/i,
      );
      await expectAssetFailure(
        tx,
        () => deleteLog(tx, otherOrgCtx, { kind: "TRIP", id: trip.id }),
        /not found|organization/i,
      );
      assert.equal(await tx.assetTrip.count({ where: { id: trip.id } }), 1);
      await expectAssetFailure(
        tx,
        async () => {
          const gbpAsset = await saveAsset(tx, ctx, {
            type: "VEHICLE",
            meterType: "KM",
            powerType: "DIESEL",
            name: "GBP Van",
            code: "V3",
            active: true,
            equipmentRatePerMeter: "166",
          });
          const gbpAllocation = await saveAllocation(tx, ctx, {
            assetId: gbpAsset.id,
            projectId: gbp.id,
            startDate: "2026-01-01",
            endDate: null,
          });
          return saveTrip(tx, ctx, {
            ...tripInput,
            assetId: gbpAsset.id,
            allocationId: gbpAllocation.id,
            projectId: gbp.id,
            outAt: "2026-06-01T08:00:00Z",
            inAt: "2026-06-01T09:00:00Z",
          });
        },
        /rate/i,
      );

      const jpyOrg = await tx.organization.create({
        data: {
          name: `${token}-jpy`,
          slug: `${token}-jpy`,
          tenantId: tenant.id,
          baseCurrency: "JPY",
        },
      });
      const jpyProject = await tx.project.create({
        data: {
          organizationId: jpyOrg.id,
          code: "J1",
          name: "JPY base",
          currency: "JPY",
        },
      });
      const jpyCtx = { ...ctx, org: jpyOrg } as OrgContext;
      const jpyAsset = await saveAsset(tx, jpyCtx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "Tiny",
        code: "J1",
        active: true,
        equipmentRatePerMeter: "1",
      });
      const jpyAllocation = await saveAllocation(tx, jpyCtx, {
        assetId: jpyAsset.id,
        projectId: jpyProject.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      const jpyTrip = await saveTrip(tx, jpyCtx, {
        ...tripInput,
        assetId: jpyAsset.id,
        allocationId: jpyAllocation.id,
        projectId: jpyProject.id,
        outAt: "2026-04-01T08:00:00Z",
        inAt: "2026-04-01T09:00:00Z",
        endReading: "0.4999",
      });
      const jpyCost = await tx.costEntry.findFirst({
        where: {
          organizationId: jpyOrg.id,
          sourceId: jpyTrip.id,
          sourceType: "ASSET_TRIP",
        },
      });
      assert.equal(jpyTrip.equipmentCost.toFixed(2), "0.00");
      assert.equal(jpyCost?.originalAmount.toFixed(0), "0");
      assert.equal(jpyCost?.amount.toFixed(0), jpyCost?.baseAmount.toFixed(0));
      assert.equal(jpyCost?.baseAmount.toFixed(0), "0");
      const jpyFuelAsset = await saveAsset(tx, jpyCtx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "DIESEL",
        name: "JPY fuel van",
        code: "J2",
        active: true,
        equipmentRatePerMeter: "0",
      });
      const jpyFuelAllocation = await saveAllocation(tx, jpyCtx, {
        assetId: jpyFuelAsset.id,
        projectId: jpyProject.id,
        startDate: "2026-01-01",
        endDate: null,
      });
      const jpyFuel = await saveFuelLog(tx, jpyCtx, {
        assetId: jpyFuelAsset.id,
        allocationId: jpyFuelAllocation.id,
        projectId: jpyProject.id,
        date: "2026-04-02",
        quantityLitres: "1",
        totalCost: "12.50",
        meterReading: "1",
      });
      assert.equal(jpyFuel.totalCost.toFixed(0), "13");
      const jpyFuelCost = await tx.costEntry.findFirst({
        where: {
          organizationId: jpyOrg.id,
          sourceId: jpyFuel.id,
          sourceType: "ASSET_FUEL",
        },
      });
      assert.equal(jpyFuelCost?.baseAmount.toFixed(0), "13");
      assert.equal(jpyFuelCost?.amount.toFixed(0), "13");

      const electric = await saveAsset(tx, ctx, {
        type: "VEHICLE",
        meterType: "KM",
        powerType: "ELECTRIC",
        name: "EV",
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
      const electricTripInput = {
        assetId: electric.id,
        allocationId: electricAllocation.id,
        projectId: project.id,
        outAt: "2026-05-01T08:00:00Z",
        inAt: "2026-05-01T10:00:00Z",
        startReading: "0",
        endReading: "10",
      };
      const electricTrip = await saveTrip(tx, ctx, electricTripInput);
      assert.equal(electricTrip.electricityCost?.toFixed(2), "60.00");
      assert.equal(electricTrip.equipmentCost.toFixed(2), "50.00");
      await saveAsset(tx, ctx, {
        id: electric.id,
        type: "VEHICLE",
        meterType: "KM",
        powerType: "ELECTRIC",
        name: "EV",
        code: "E1",
        active: true,
        equipmentRatePerMeter: "9",
        powerRatingKw: "20",
        electricityTariff: "4",
      });
      const edited = await saveTrip(tx, ctx, {
        ...electricTripInput,
        id: electricTrip.id,
        inAt: "2026-05-01T10:30:00Z",
        endReading: "11",
      });
      assert.equal(edited.equipmentRateSnapshot.toFixed(2), "5.00");
      assert.equal(edited.powerRatingKwSnapshot?.toFixed(2), "10.00");
      assert.equal(edited.electricityTariffSnapshot?.toFixed(2), "3.00");
      assert.equal(edited.electricityCost?.toFixed(2), "75.00");
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, sourceId: electricTrip.id },
        }),
        2,
      );
      await deleteLog(tx, ctx, { kind: "TRIP", id: electricTrip.id });
      assert.equal(
        await tx.costEntry.count({
          where: { organizationId: org.id, sourceId: electricTrip.id },
        }),
        0,
      );
    });
  },
);
