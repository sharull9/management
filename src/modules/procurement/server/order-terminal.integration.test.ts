import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";

// Installed Node types target v20; the local database runner uses Node 24.
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
  "purchase order terminal transitions enforce workflow guards and audit once",
  {
    skip:
      process.env.PROCUREMENT_DB_TEST !== "local-only" ||
      process.env.DATABASE_URL === undefined,
  },
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "PROCUREMENT_DB_TEST requires a loopback DATABASE_URL",
    );
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);
        return specifier === "server-only"
          ? { ...resolved, url: resolved.url.replace("index.js", "empty.js") }
          : resolved;
      },
    });
    const { db } = await import("@/core/db");
    const { changePurchaseOrderStatus } = await import(
      "./order-terminal-service"
    );
    const rollback = new Error("ROLLBACK_PROCUREMENT_TERMINAL_TEST");
    try {
      await db.$transaction(
        async (tx) => {
          const token = `poterm-${crypto.randomUUID()}`;
          const tenant = await tx.tenant.create({
            data: { name: token, slug: token },
          });
          const org = await tx.organization.create({
            data: { name: token, slug: token, tenantId: tenant.id },
          });
          const user = await tx.user.create({
            data: { name: token, email: `${token}@example.test` },
          });
          const vendor = await tx.party.create({
            data: {
              tenantId: tenant.id,
              code: token,
              legalName: token,
              displayName: token,
              isVendor: true,
            },
          });
          const project = await tx.project.create({
            data: {
              organizationId: org.id,
              code: token,
              name: token,
              currency: "INR",
            },
          });
          const ctx = {
            org,
            tenant,
            user,
            isAdmin: true,
            permissions: new Set(["purchase.order.create"]),
            member: null,
            tenantRole: "OWNER",
            project,
          } as unknown as OrgContext & { project: typeof project };

          const makeOrder = async (status: string) =>
            tx.purchaseOrder.create({
              data: {
                organizationId: org.id,
                projectId: project.id,
                code: `${token}-${crypto.randomUUID()}`,
                status: status as never,
                vendorPartyId: vendor.id,
                date: new Date("2026-01-01"),
                currency: "INR",
                subtotal: 0,
                taxTotal: 0,
                withholdingTotal: 0,
                grandTotal: 0,
                createdById: user.id,
              },
            });
          const expectFailure = async (
            work: () => Promise<unknown>,
            pattern: RegExp,
          ) => {
            await tx.$executeRawUnsafe(
              "SAVEPOINT po_terminal_expected_failure",
            );
            try {
              await assert.rejects(work, (error: unknown) => {
                assert.match(String(error), pattern);
                return true;
              });
            } finally {
              await tx.$executeRawUnsafe(
                "ROLLBACK TO SAVEPOINT po_terminal_expected_failure",
              );
              await tx.$executeRawUnsafe(
                "RELEASE SAVEPOINT po_terminal_expected_failure",
              );
            }
          };

          // Cancellation is allowed for both editable and approved orders.
          for (const status of ["DRAFT", "APPROVED"]) {
            const order = await makeOrder(status);
            const result = await changePurchaseOrderStatus(tx, ctx, {
              id: order.id,
              action: "CANCEL",
            });
            assert.equal(result.status, "CANCELLED");
          }

          // Closing accepts every received lifecycle state; bills do not block close.
          for (const status of ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"]) {
            const order = await makeOrder(status);
            const result = await changePurchaseOrderStatus(tx, ctx, {
              id: order.id,
              action: "CLOSE",
            });
            assert.equal(result.status, "CLOSED");
            const auditCount = await tx.auditLog.count({
              where: {
                organizationId: org.id,
                entityType: "PurchaseOrder",
                entityId: order.id,
              },
            });
            await changePurchaseOrderStatus(tx, ctx, {
              id: order.id,
              action: "CLOSE",
            });
            assert.equal(
              await tx.auditLog.count({
                where: {
                  organizationId: org.id,
                  entityType: "PurchaseOrder",
                  entityId: order.id,
                },
              }),
              auditCount,
              "same terminal retry must not create another audit record",
            );
          }

          // An active draft receipt blocks both cancellation and closure.
          const blocked = await makeOrder("APPROVED");
          await tx.goodsReceipt.create({
            data: {
              organizationId: org.id,
              projectId: project.id,
              code: `${token}-draft-receipt`,
              poId: blocked.id,
              currency: "INR",
              receivedDate: new Date("2026-01-01"),
              receivedById: user.id,
            },
          });
          await expectFailure(
            () =>
              changePurchaseOrderStatus(tx, ctx, {
                id: blocked.id,
                action: "CANCEL",
              }),
            /active receipts or bills/,
          );
          await expectFailure(
            () =>
              changePurchaseOrderStatus(tx, ctx, {
                id: blocked.id,
                action: "CLOSE",
              }),
            /draft or pending receipts/,
          );

          const billed = await makeOrder("APPROVED");
          const bill = await tx.vendorBill.create({
            data: {
              organizationId: org.id,
              projectId: project.id,
              partyId: vendor.id,
              code: `${token}-bill`,
              vendorInvoiceNo: token,
              vendorInvoiceDate: new Date("2026-01-01"),
              purchaseOrderId: billed.id,
              currency: "INR",
              subtotal: 0,
              taxTotal: 0,
              grandTotal: 0,
              payableTotal: 0,
              createdById: user.id,
            },
          });
          await expectFailure(
            () =>
              changePurchaseOrderStatus(tx, ctx, {
                id: billed.id,
                action: "CANCEL",
              }),
            /active receipts or bills/,
          );
          assert.equal(
            (
              await changePurchaseOrderStatus(tx, ctx, {
                id: billed.id,
                action: "CLOSE",
              })
            ).status,
            "CLOSED",
          );
          assert.equal(
            (await tx.vendorBill.findUniqueOrThrow({ where: { id: bill.id } }))
              .status,
            "DRAFT",
          );

          const received = await makeOrder("APPROVED");
          const group = await tx.uomGroup.create({
            data: { tenantId: tenant.id, key: token, name: token },
          });
          const unit = await tx.uom.create({
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
              stockUomId: unit.id,
            },
          });
          const variant = await tx.itemVariant.create({
            data: { itemId: item.id, key: token, name: token },
          });
          await tx.purchaseOrderLine.create({
            data: {
              orderId: received.id,
              itemVariantId: variant.id,
              description: token,
              qty: 2,
              receivedQty: 1,
              uomId: unit.id,
              rate: 1,
              discountPercent: 0,
              netAmount: 2,
              netRate: 1,
              stockFactor: 1,
              stockUomId: unit.id,
            },
          });
          await expectFailure(
            () =>
              changePurchaseOrderStatus(tx, ctx, {
                id: received.id,
                action: "CANCEL",
              }),
            /received quantities/,
          );
          await changePurchaseOrderStatus(tx, ctx, {
            id: received.id,
            action: "CLOSE",
          });
          const { saveGoodsReceipt } = await import("./receipt-service");
          await expectFailure(
            () =>
              saveGoodsReceipt(tx, ctx, {
                id: null,
                projectId: project.id,
                poId: received.id,
                siteId: null,
                receivedDate: new Date("2026-01-02"),
                exchangeRate: null,
                challanNumber: "",
                vehicleNumber: "",
                lines: [],
              }),
            /No record was found/i,
          );
          for (const status of [
            "PENDING_APPROVAL",
            "PARTIALLY_RECEIVED",
            "RECEIVED",
            "CLOSED",
          ]) {
            const order = await makeOrder(status);
            await expectFailure(
              () =>
                changePurchaseOrderStatus(tx, ctx, {
                  id: order.id,
                  action: "CANCEL",
                }),
              /Only draft or approved/,
            );
          }
          const draft = await makeOrder("DRAFT");
          await expectFailure(
            () =>
              changePurchaseOrderStatus(tx, ctx, {
                id: draft.id,
                action: "CLOSE",
              }),
            /Only approved or received/,
          );

          // Permission and project/organization scoping are enforced before mutation.
          const protectedOrder = await makeOrder("APPROVED");
          await expectFailure(
            () =>
              changePurchaseOrderStatus(
                tx,
                { ...ctx, isAdmin: false, permissions: new Set() },
                { id: protectedOrder.id, action: "CLOSE" },
              ),
            /permission/i,
          );
          await expectFailure(
            () =>
              changePurchaseOrderStatus(
                tx,
                { ...ctx, project: { ...project, id: "other-project" } },
                { id: protectedOrder.id, action: "CLOSE" },
              ),
            /outside the authorized project/,
          );
          await expectFailure(
            () =>
              changePurchaseOrderStatus(
                tx,
                { ...ctx, org: { ...ctx.org, id: "other-org" } },
                { id: protectedOrder.id, action: "CLOSE" },
              ),
            /No record was found for a query/i,
          );

          throw rollback;
        },
        { maxWait: 15_000, timeout: 60_000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      hooks.deregister();
      await db.$disconnect();
    }
  },
);
