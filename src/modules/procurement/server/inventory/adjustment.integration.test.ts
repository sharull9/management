import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";
import { Decimal } from "@/core/decimal";
import { adjustmentInput } from "../../adjustment-schema";

type Resolve = (specifier: string, context: object) => { url: string };
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: (
      specifier: string,
      context: object,
      next: Resolve,
    ) => { url: string };
  }) => { deregister: () => void };
};

test(
  "stock adjustments atomically post valuation, enforce scope and serialize competing withdrawals",
  {
    skip: process.env.PROCUREMENT_DB_TEST !== "local-only",
  },
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
    assert.match(url.pathname, /_test$/);
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        const resolved = next(specifier, context);
        return specifier === "server-only"
          ? { ...resolved, url: resolved.url.replace("index.js", "empty.js") }
          : resolved;
      },
    });
    const { db } = await import("@/core/db");
    try {
      const { recordStockAdjustment } = await import("./adjustment-service");
      const { stockBalance } = await import("./service");
      const { stockAdjustmentData } = await import("../adjustment-queries");
      const fixture = await db.$transaction(async (tx) => {
        const token = `stock-adjust-${crypto.randomUUID()}`;
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
            name: token,
            code: token,
            currency: "INR",
          },
        });
        const group = await tx.uomGroup.create({
          data: { tenantId: tenant.id, key: token, name: token },
        });
        const uom = await tx.uom.create({
          data: {
            tenantId: tenant.id,
            groupId: group.id,
            code: "EA",
            name: "Each",
            factor: 1,
            isBase: true,
          },
        });
        const item = await tx.item.create({
          data: {
            tenantId: tenant.id,
            code: token,
            name: token,
            type: "RAW_MATERIAL",
            stockUomId: uom.id,
            stockTracked: true,
          },
        });
        const variant = await tx.itemVariant.create({
          data: { itemId: item.id, key: token, name: token },
        });
        const otherTenant = await tx.tenant.create({
          data: { name: `${token}-other`, slug: `${token}-other` },
        });
        const otherItem = await tx.item.create({
          data: {
            tenantId: otherTenant.id,
            code: token,
            name: token,
            type: "RAW_MATERIAL",
            stockUomId: uom.id,
            stockTracked: true,
          },
        });
        const otherVariant = await tx.itemVariant.create({
          data: { itemId: otherItem.id, key: `${token}-other`, name: token },
        });
        return { tenant, org, user, project, variant, otherVariant };
      });
      const ctx = {
        ...fixture,
        org: { ...fixture.org, tenant: fixture.tenant },
        member: null,
        tenantRole: "OWNER",
        isAdmin: true,
        permissions: new Set<string>(),
      } as unknown as OrgContext & { project: { id: string } };
      const input = {
        projectId: fixture.project.id,
        itemVariantId: fixture.variant.id,
        date: "2026-10-30",
        direction: "INCREASE",
        qty: "10",
        unitCost: "3.33333333",
        reason: "Physical count",
      };
      const record = (patch: Partial<typeof input> = {}, context = ctx) =>
        db.$transaction(
          (tx) =>
            recordStockAdjustment(
              tx,
              context,
              adjustmentInput.parse({ ...input, ...patch }),
            ),
          { timeout: 20000 },
        );
      const balance = () =>
        db.$transaction((tx) =>
          stockBalance(
            tx,
            fixture.org.id,
            fixture.project.id,
            fixture.variant.id,
          ),
        );
      const added = await record();
      assert.equal(added.totalCost.toString(), "33.3333333");
      assert.equal(added.reason, "Physical count");
      assert.equal(added.recordedById, fixture.user.id);
      const removed = await record({
        direction: "DECREASE",
        qty: "3",
        unitCost: "999",
      });
      assert.equal(removed.totalCost.toString(), "-9.99999999");
      const source = await db.accountingSource.findFirstOrThrow({
        where: {
          organizationId: fixture.org.id,
          sourceId: removed.id,
          sourceType: "STOCK_MOVEMENT",
        },
      });
      const lines = await db.journalLine.findMany({
        where: { journalEntryId: source.currentEntryId ?? "" },
        include: { account: true },
      });
      assert.equal(
        lines
          .find((line) => line.account.systemKey === "INVENTORY_ADJUSTMENT")
          ?.debit.toString(),
        "10",
      );
      assert.equal(
        lines
          .find((line) => line.account.systemKey === "INVENTORY")
          ?.credit.toString(),
        "10",
      );
      assert.equal(
        lines
          .reduce(
            (sum, line) => sum.add(line.debit).sub(line.credit),
            new Decimal(0),
          )
          .toString(),
        "0",
      );
      assert.equal(
        await db.auditLog.count({
          where: { entityId: removed.id, userId: fixture.user.id },
        }),
        1,
      );
      await assert.rejects(
        record({}, { ...ctx, isAdmin: false, permissions: new Set() }),
        /permission/,
      );
      await assert.rejects(
        record({ projectId: "outside-project" }),
        /authorized project/,
      );
      await assert.rejects(
        record({ itemVariantId: fixture.otherVariant.id }),
        /this tenant/,
      );
      await assert.rejects(record({ date: "2026-10-29" }), /predate/);
      await assert.rejects(
        record({ direction: "DECREASE", qty: "8" }),
        /Insufficient stock/,
      );
      assert.equal((await balance()).qty.toString(), "7");
      await record({ direction: "DECREASE", qty: "7" });
      assert.equal((await balance()).value.toString(), "0");
      await record({ qty: "5", unitCost: "2" });
      const races = await Promise.allSettled([
        record({ direction: "DECREASE", qty: "4" }),
        record({ direction: "DECREASE", qty: "4" }),
      ]);
      assert.equal(
        races.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        races.filter((result) => result.status === "rejected").length,
        1,
      );
      assert.equal((await balance()).qty.toString(), "1");
      assert.equal((await balance()).value.toString(), "2");
      const zero = await record({ qty: "1", unitCost: "0" });
      assert.equal(
        await db.journalEntry.count({
          where: { organizationId: fixture.org.id, sourceDocumentId: zero.id },
        }),
        0,
      );
      await db.stockMovement.createMany({
        data: Array.from({ length: 25 }, () => ({
          organizationId: fixture.org.id,
          projectId: fixture.project.id,
          itemVariantId: fixture.variant.id,
          date: new Date("2026-10-30"),
          type: "ADJUSTMENT",
          qty: 1,
          unitCost: 0,
          totalCost: 0,
          sourceType: "STOCK_ADJUSTMENT",
          sourceId: crypto.randomUUID(),
          reason: "Physical count pagination",
          recordedById: fixture.user.id,
        })),
      });
      const history = await stockAdjustmentData(ctx, [fixture.project.id], {
        search: "Physical count",
        page: "2",
      });
      assert.equal(history.page.total, 31);
      assert.equal(history.rows.length, 6);
      assert.equal((await stockAdjustmentData(ctx, [], {})).page.total, 0);
      assert.equal(
        (
          await stockAdjustmentData(ctx, [fixture.project.id], {
            search: "missing",
          })
        ).page.total,
        0,
      );
      // A posting failure rolls back the stock movement and its audit too.
      const blockedOrg = await db.organization.create({
        data: {
          name: "Blocked chart",
          slug: crypto.randomUUID(),
          tenantId: fixture.tenant.id,
        },
      });
      const blockedProject = await db.project.create({
        data: {
          organizationId: blockedOrg.id,
          code: "B",
          name: "Blocked",
          currency: "INR",
        },
      });
      await db.ledgerAccount.create({
        data: {
          organizationId: blockedOrg.id,
          code: "1300",
          name: "Conflicting custom account",
          type: "ASSET",
        },
      });
      await assert.rejects(
        record(
          { projectId: blockedProject.id, qty: "1", unitCost: "5" },
          {
            ...ctx,
            org: { ...blockedOrg, tenant: fixture.tenant },
            project: blockedProject,
          },
        ),
        /account code 1300/,
      );
      assert.equal(
        await db.stockMovement.count({
          where: { organizationId: blockedOrg.id },
        }),
        0,
      );
      assert.equal(
        await db.journalEntry.count({
          where: { organizationId: blockedOrg.id },
        }),
        0,
      );
      assert.equal(
        await db.auditLog.count({
          where: { organizationId: blockedOrg.id, entityType: "StockMovement" },
        }),
        0,
      );
    } finally {
      await db.$disconnect();
      hooks.deregister();
    }
  },
);
