import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";

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

type TestContext = OrgContext & { project?: { id: string } };
const state = globalThis as typeof globalThis & {
  __procurementReadContexts?: {
    org: TestContext;
    projects: Map<string, TestContext>;
  };
};

test(
  "procurement lists, item hydration, and bill receipt picker query scoped database rows",
  {
    skip:
      process.env.PROCUREMENT_DB_TEST !== "local-only" ||
      process.env.DATABASE_URL === undefined,
  },
  async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(
      ["postgresql:", "postgres:"].includes(databaseUrl.protocol) &&
        ["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname) &&
        /_test$/.test(databaseUrl.pathname),
      "Procurement read integration tests require a disposable loopback database ending in _test.",
    );
    const contextUrl = new URL(
      "./read-queries.test-context.ts",
      import.meta.url,
    ).href;
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);
        if (specifier === "server-only")
          return {
            ...resolved,
            url: resolved.url.replace("index.js", "empty.js"),
          };
        if (specifier === "@/core/context")
          return { ...resolved, url: contextUrl };
        return resolved;
      },
    });
    let db: typeof import("@/core/db").db | undefined;
    let tenantId = "";
    let foreignTenantId = "";
    let organizationId = "";
    let userId = "";
    let vendorId = "";
    const groupIds: string[] = [];
    const uomIds: string[] = [];
    const itemIds: string[] = [];
    const projectIds: string[] = [];
    const requestIds: string[] = [];
    const orderIds: string[] = [];
    const receiptIds: string[] = [];
    const billIds: string[] = [];
    try {
      ({ db } = await import("@/core/db"));
      if (!db) throw new Error("Database client did not load.");
      const client = db;
      const token = `proc-read-${crypto.randomUUID()}`;
      const currency = await db.currency.findUnique({ where: { code: "INR" } });
      assert.ok(
        currency,
        "the isolated database must include the INR currency seed",
      );
      const tenant = await db.tenant.create({
        data: { name: token, slug: token },
      });
      tenantId = tenant.id;
      const foreignTenant = await db.tenant.create({
        data: { name: `${token}-foreign`, slug: `${token}-foreign` },
      });
      foreignTenantId = foreignTenant.id;
      const org = await db.organization.create({
        data: { name: token, slug: token, tenantId: tenant.id },
      });
      organizationId = org.id;
      const user = await db.user.create({
        data: { name: token, email: `${token}@example.test` },
      });
      userId = user.id;
      const vendor = await db.party.create({
        data: {
          tenantId,
          code: token,
          legalName: token,
          displayName: token,
          isVendor: true,
        },
      });
      vendorId = vendor.id;
      const projects = await Promise.all(
        ["alpha", "beta"].map((suffix) =>
          client.project.create({
            data: {
              organizationId,
              code: `${token}-${suffix}`,
              name: `${token}-${suffix}`,
              currency: "INR",
            },
          }),
        ),
      );
      projectIds.push(...projects.map((project) => project.id));
      const orgContext = {
        org,
        tenant,
        user,
        member: null,
        tenantRole: "OWNER",
        isAdmin: true,
        permissions: new Set<string>(),
      } as unknown as TestContext;
      state.__procurementReadContexts = {
        org: orgContext,
        projects: new Map(
          projects.map((project) => [project.id, { ...orgContext, project }]),
        ),
      };

      const [group, otherGroup] = await Promise.all([
        db.uomGroup.create({
          data: { tenantId, key: `${token}-uom`, name: token },
        }),
        db.uomGroup.create({
          data: { key: `${token}-other`, name: `${token}-other` },
        }),
      ]);
      groupIds.push(group.id, otherGroup.id);
      const [uom, otherUom] = await Promise.all([
        db.uom.create({
          data: {
            tenantId,
            groupId: group.id,
            code: "EA",
            name: "Each",
            factor: 1,
            isBase: true,
          },
        }),
        db.uom.create({
          data: {
            groupId: otherGroup.id,
            code: "EA",
            name: "Each",
            factor: 1,
            isBase: true,
          },
        }),
      ]);
      uomIds.push(uom.id, otherUom.id);
      const uomId = uom.id;
      const [activeItem, inactiveItem, foreignItem] = await Promise.all([
        db.item.create({
          data: {
            tenantId,
            code: `${token}-active`,
            name: `${token} active item`,
            type: "RAW_MATERIAL",
            stockUomId: uom.id,
            stockTracked: true,
          },
        }),
        db.item.create({
          data: {
            tenantId,
            code: `${token}-inactive`,
            name: `${token} inactive item`,
            type: "RAW_MATERIAL",
            stockUomId: uom.id,
            active: false,
            stockTracked: true,
          },
        }),
        db.item.create({
          data: {
            tenantId: foreignTenantId,
            code: `${token}-foreign`,
            name: `${token} foreign item`,
            type: "RAW_MATERIAL",
            stockUomId: otherUom.id,
            stockTracked: true,
          },
        }),
      ]);
      itemIds.push(activeItem.id, inactiveItem.id, foreignItem.id);

      const requestRows = await Promise.all(
        Array.from({ length: 26 }, (_, index) =>
          client.purchaseRequest.create({
            data: {
              organizationId,
              projectId: projects[0].id,
              code: `${token}-request-${String(index).padStart(2, "0")}`,
              requestedById: userId,
              estimatedTotal: index,
            },
          }),
        ),
      );
      requestIds.push(...requestRows.map((row) => row.id));
      const otherRequest = await db.purchaseRequest.create({
        data: {
          organizationId,
          projectId: projects[1].id,
          code: `${token}-other-project`,
          requestedById: userId,
          estimatedTotal: 100,
        },
      });
      requestIds.push(otherRequest.id);

      const { procurementList } = await import("./list-queries");
      const firstPage = await procurementList(
        org.slug,
        "requests",
        projects[0].id,
        { sort: "code", sortDirection: "asc" },
      );
      assert.equal(firstPage.page.total, 26);
      assert.equal(firstPage.rows.length, 25);
      assert.match(firstPage.rows[0].code, /request-00$/);
      const secondPage = await procurementList(
        org.slug,
        "requests",
        projects[0].id,
        { page: "2", sort: "code", sortDirection: "asc" },
      );
      assert.equal(secondPage.page.total, 26);
      assert.equal(secondPage.rows.length, 1);
      assert.match(secondPage.rows[0].code, /request-25$/);
      const searched = await procurementList(
        org.slug,
        "requests",
        projects[0].id,
        { search: "request-0", sort: "code", sortDirection: "desc" },
      );
      assert.equal(searched.page.total, 10);
      assert.match(searched.rows[0].code, /request-09$/);
      state.__procurementReadContexts.org = {
        ...orgContext,
        isAdmin: false,
        permissions: new Set(),
      };
      state.__procurementReadContexts.projects.set(projects[0].id, {
        ...orgContext,
        project: projects[0],
        isAdmin: false,
        permissions: new Set(),
      });
      await assert.rejects(
        () => procurementList(org.slug, "requests", projects[0].id),
        /permission/i,
        "project scoped lists reject users without the document permission",
      );
      state.__procurementReadContexts.org = orgContext;
      state.__procurementReadContexts.projects.set(projects[0].id, {
        ...orgContext,
        project: projects[0],
      });

      const { pickerItems } = await import("@/modules/masters/server/queries");
      const pickedItems = await pickerItems(tenantId, {
        stockOnly: true,
        search: `${token} active`,
        take: 1,
        selectedIds: [inactiveItem.id, foreignItem.id],
      });
      assert.deepEqual(
        pickedItems.map((item) => item.id).sort(),
        [activeItem.id, inactiveItem.id].sort(),
        "an inactive selected item remains hydrated without weakening tenant scope",
      );
      assert.equal(
        pickedItems.some((item) => item.id === foreignItem.id),
        false,
      );

      const order = await db.purchaseOrder.create({
        data: {
          organizationId,
          projectId: projects[0].id,
          code: `${token}-receipt-order`,
          status: "APPROVED",
          vendorPartyId: vendorId,
          date: new Date("2026-01-01"),
          currency: "INR",
          subtotal: 26,
          taxTotal: 0,
          withholdingTotal: 0,
          grandTotal: 26,
          createdById: userId,
          lines: {
            create: {
              variant: {
                create: {
                  itemId: activeItem.id,
                  key: token,
                  name: `${token} variant`,
                },
              },
              description: `${token} receipt line`,
              qty: 26,
              receivedQty: 26,
              uom: { connect: { id: uomId } },
              rate: 1,
              discountPercent: 0,
              netAmount: 26,
              netRate: 1,
              stockFactor: 1,
              stockUom: { connect: { id: uomId } },
            },
          },
        },
        include: { lines: true },
      });
      orderIds.push(order.id);
      const receipt = await db.goodsReceipt.create({
        data: {
          organizationId,
          projectId: projects[0].id,
          code: `${token}-receipt`,
          status: "APPROVED",
          poId: order.id,
          currency: "INR",
          receivedDate: new Date("2026-01-02"),
          receivedById: userId,
          lines: {
            create: Array.from({ length: 26 }, (_, index) => ({
              poLineId: order.lines[0].id,
              receivedQty: 1,
              acceptedQty: 1,
              rejectedQty: 0,
              uomId,
              remarks: `${token}-${String(index).padStart(2, "0")}`,
            })),
          },
        },
        include: { lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      });
      receiptIds.push(receipt.id);
      const activeBill = await db.vendorBill.create({
        data: {
          organizationId,
          projectId: projects[0].id,
          partyId: vendorId,
          code: `${token}-bill`,
          vendorInvoiceNo: token,
          vendorInvoiceDate: new Date("2026-01-03"),
          purchaseOrderId: order.id,
          currency: "INR",
          subtotal: 25,
          taxTotal: 0,
          grandTotal: 25,
          payableTotal: 25,
          status: "APPROVED",
          createdById: userId,
          lines: {
            create: receipt.lines.slice(0, 25).map((line) => ({
              poLineId: order.lines[0].id,
              grnLineId: line.id,
              itemVariantId: order.lines[0].itemVariantId,
              description: token,
              qty: 1,
              uomId,
              rate: 1,
              lineSubtotal: 1,
              lineTax: 0,
              lineTotal: 1,
            })),
          },
        },
      });
      billIds.push(activeBill.id);

      const { findBillReceipts } = await import(
        "@/modules/vendor-bill/server/picker-actions"
      );
      const available = await findBillReceipts(org.slug, order.id, null, token);
      assert.equal(available.length, 1);
      assert.equal(available[0].value, receipt.lines[25].id);
      assert.equal(available[0].description, "Available: 1");
      const editing = await findBillReceipts(
        org.slug,
        order.id,
        activeBill.id,
        token,
      );
      assert.equal(editing.length, 25);
      assert.equal(editing[0].value, receipt.lines[0].id);
      await db.vendorBill.update({
        where: { id: activeBill.id },
        data: { status: "CANCELLED" },
      });
      const afterCancellation = await findBillReceipts(
        org.slug,
        order.id,
        null,
        token,
      );
      assert.equal(afterCancellation.length, 25);
      assert.equal(afterCancellation[0].value, receipt.lines[0].id);
    } finally {
      if (db) {
        if (billIds.length) {
          await db.vendorBillLine.deleteMany({
            where: { billId: { in: billIds } },
          });
          await db.vendorBill.deleteMany({ where: { id: { in: billIds } } });
        }
        if (receiptIds.length) {
          await db.goodsReceiptLine.deleteMany({
            where: { receiptId: { in: receiptIds } },
          });
          await db.goodsReceipt.deleteMany({
            where: { id: { in: receiptIds } },
          });
        }
        if (orderIds.length) {
          await db.purchaseOrderLine.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await db.purchaseOrder.deleteMany({
            where: { id: { in: orderIds } },
          });
        }
        if (requestIds.length)
          await db.purchaseRequest.deleteMany({
            where: { id: { in: requestIds } },
          });
        if (projectIds.length)
          await db.project.deleteMany({ where: { id: { in: projectIds } } });
        if (organizationId)
          await db.organization.delete({ where: { id: organizationId } });
        if (vendorId) await db.party.delete({ where: { id: vendorId } });
        if (itemIds.length)
          await db.itemVariant.deleteMany({
            where: { itemId: { in: itemIds } },
          });
        if (itemIds.length)
          await db.item.deleteMany({ where: { id: { in: itemIds } } });
        if (uomIds.length)
          await db.uom.deleteMany({ where: { id: { in: uomIds } } });
        if (groupIds.length)
          await db.uomGroup.deleteMany({ where: { id: { in: groupIds } } });
        if (tenantId) await db.tenant.delete({ where: { id: tenantId } });
        if (foreignTenantId)
          await db.tenant.delete({ where: { id: foreignTenantId } });
        if (userId) await db.user.delete({ where: { id: userId } });
        await db.$disconnect();
      }
      delete state.__procurementReadContexts;
      hooks.deregister();
    }
  },
);
