import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { SYSTEM_ACCOUNTS } from "../constants";
import { sourceTestBase } from "./source-test-fixtures";

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

async function rollbackAfter<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  const rollback = new Error("ROLLBACK_CONCURRENCY_POSTING");
  const { db } = await import("@/core/db");
  let result: T | undefined;
  await db
    .$transaction(async (tx) => {
      result = await work(tx);
      throw rollback;
    })
    .catch((error: unknown) => assert.equal(error, rollback));
  return result as T;
}

async function cleanupTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
) {
  const organizations = await tx.organization.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const organizationIds = organizations.map((row) => row.id);
  if (
    (await tx.journalEntry.count({
      where: { organizationId: { in: organizationIds } },
    })) > 0
  )
    return; // Posted journal history is immutable; the disposable DB is dropped by the caller.
  const bills = await tx.vendorBill.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true },
  });
  const approvalRequests = await tx.approvalRequest.findMany({
    where: {
      organizationId: { in: organizationIds },
      documentType: "VENDOR_BILL",
      documentId: { in: bills.map((row) => row.id) },
    },
    select: { id: true },
  });
  await tx.vendorBillLine.deleteMany({
    where: { billId: { in: bills.map((row) => row.id) } },
  });
  await tx.vendorBill.deleteMany({
    where: { id: { in: bills.map((row) => row.id) } },
  });
  await tx.approvalRequestStep.deleteMany({
    where: { requestId: { in: approvalRequests.map((row) => row.id) } },
  });
  await tx.approvalRequest.deleteMany({
    where: { id: { in: approvalRequests.map((row) => row.id) } },
  });
  await tx.goodsReceiptLine.deleteMany({
    where: { receipt: { organizationId: { in: organizationIds } } },
  });
  await tx.goodsReceipt.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.purchaseOrderLine.deleteMany({
    where: { order: { organizationId: { in: organizationIds } } },
  });
  await tx.purchaseOrder.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.payment.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.assetTrip.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.costEntry.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.accountingSource.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.auditLog.deleteMany({ where: { tenantId } });
  await tx.ledgerAccount.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.accountTemplate.deleteMany({ where: { tenantId } });
  await tx.assetAllocation.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.asset.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.item.deleteMany({ where: { tenantId } });
  await tx.project.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await tx.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await tx.party.deleteMany({ where: { tenantId } });
  await tx.uom.deleteMany({ where: { group: { tenantId } } });
  await tx.uomGroup.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
  await tx.user.delete({ where: { id: userId } });
}

test(
  "live payment, asset allocation and tenant chart entrypoints serialize across connections",
  { skip: process.env.CONCURRENCY_DB_TEST !== "local-only" },
  async () => {
    assert.equal(process.env.DATABASE_POOL_MAX, "10");
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    assert.match(url.pathname, /_test$/);
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);
        return specifier === "server-only"
          ? { ...resolved, url: resolved.url.replace("index.js", "empty.js") }
          : resolved;
      },
    });
    const { db } = await import("@/core/db");
    const fixture = await db.$transaction(async (tx) => {
      const base = await sourceTestBase(tx);
      const secondOrg = await tx.organization.create({
        data: {
          name: `${base.token}-second`,
          slug: `${base.token}-second`,
          tenantId: base.tenant.id,
        },
      });
      const payment = await tx.payment.create({
        data: {
          organizationId: base.org.id,
          partyId: base.party.id,
          projectId: base.project.id,
          code: `${base.token}-PAY`,
          direction: "OUTGOING",
          date: new Date("2026-01-01"),
          mode: "BANK",
          currency: "INR",
          amount: 10,
          baseAmount: 10,
          allocatedAmount: 0,
          unallocatedAmount: 10,
          status: "POSTED",
          createdById: base.user.id,
        },
      });
      const asset = await tx.asset.create({
        data: {
          organizationId: base.org.id,
          type: "MACHINE",
          meterType: "HOURS",
          powerType: "OTHER",
          name: `${base.token}-asset`,
          code: `${base.token}-asset`,
          equipmentRatePerMeter: 1,
          createdById: base.user.id,
        },
      });
      const group = await tx.uomGroup.create({
        data: {
          tenantId: base.tenant.id,
          key: base.token.concat("-ea"),
          name: "Each",
        },
      });
      const uom = await tx.uom.create({
        data: {
          tenantId: base.tenant.id,
          groupId: group.id,
          code: "EA",
          name: "Each",
          factor: 1,
          isBase: true,
        },
      });
      const item = await tx.item.create({
        data: {
          tenantId: base.tenant.id,
          code: base.token.concat("-item"),
          name: "Receipt race item",
          type: "RAW_MATERIAL",
          stockUomId: uom.id,
          stockTracked: true,
        },
      });
      const variant = await tx.itemVariant.create({
        data: { itemId: item.id, key: base.token.concat("-variant") },
      });
      const order = await tx.purchaseOrder.create({
        data: {
          organizationId: base.org.id,
          projectId: base.project.id,
          code: base.token.concat("-PO"),
          status: "APPROVED",
          vendorPartyId: base.party.id,
          date: new Date("2026-01-01"),
          currency: "INR",
          subtotal: 1,
          taxTotal: 0,
          withholdingTotal: 0,
          grandTotal: 1,
          createdById: base.user.id,
          lines: {
            create: {
              itemVariantId: variant.id,
              description: "Receipt race item",
              qty: 1,
              uomId: uom.id,
              stockUomId: uom.id,
              stockFactor: 1,
              rate: 1,
              netRate: 1,
              netAmount: 1,
              discountPercent: 0,
            },
          },
        },
        include: { lines: true },
      });
      const poLine = order.lines[0];
      assert.ok(poLine);
      await tx.purchaseOrderLine.update({
        where: { id: poLine.id },
        data: { receivedQty: 0 },
      });
      const approvalRequest = await tx.approvalRequest.create({
        data: {
          organizationId: base.org.id,
          documentType: "VENDOR_BILL",
          documentId: `${base.token}-bill`,
          title: `${base.token} linked bill`,
          requestedById: base.user.id,
          status: "PENDING",
        },
      });
      const bill = await tx.vendorBill.create({
        data: {
          organizationId: base.org.id,
          projectId: base.project.id,
          partyId: base.party.id,
          code: `${base.token}-BILL`,
          vendorInvoiceNo: `${base.token}-INV`,
          vendorInvoiceDate: new Date("2026-01-01"),
          purchaseOrderId: order.id,
          currency: "INR",
          subtotal: 0.5,
          taxTotal: 0,
          grandTotal: 0.5,
          payableTotal: 0.5,
          baseSubtotal: 0.5,
          baseGrandTotal: 0.5,
          basePayableTotal: 0.5,
          status: "PENDING_APPROVAL",
          approvalRequestId: approvalRequest.id,
          createdById: base.user.id,
          lines: {
            create: {
              poLineId: poLine.id,
              itemVariantId: poLine.itemVariantId,
              description: "Linked bill concurrency fixture",
              qty: 0.5,
              uomId: uom.id,
              rate: 1,
              lineSubtotal: 0.5,
              lineTax: 0,
              lineTotal: 0.5,
            },
          },
        },
      });
      const priorBill = await tx.vendorBill.create({
        data: {
          ...bill,
          id: undefined,
          code: `${base.token}-PRIOR-BILL`,
          vendorInvoiceNo: `${base.token}-PRIOR-INV`,
          approvalRequestId: null,
          status: "APPROVED",
        },
      });
      await tx.vendorBillLine.create({
        data: {
          billId: priorBill.id,
          poLineId: poLine.id,
          itemVariantId: poLine.itemVariantId,
          description: "Existing accepted bill",
          qty: 0.5,
          uomId: uom.id,
          rate: 1,
          lineSubtotal: 0.5,
          lineTax: 0,
          lineTotal: 0.5,
        },
      });
      await tx.approvalRequest.update({
        where: { id: approvalRequest.id },
        data: { documentId: bill.id },
      });
      const linkedApproval = await tx.approvalRequest.findUniqueOrThrow({
        where: { id: approvalRequest.id },
      });
      return {
        ...base,
        secondOrg,
        payment,
        asset,
        order,
        uom,
        bill,
        approvalRequest: linkedApproval,
      };
    });

    const {
      org,
      secondOrg,
      tenant,
      user,
      project,
      payment,
      asset,
      order,
      uom,
      bill,
      approvalRequest,
    } = fixture;
    const { ensureOrgChart } = await import("./chart-service");
    const { syncAccountingHistoryBatch } = await import("./history-service");
    const { voidPayment } = await import(
      "@/modules/payment/server/void-service"
    );
    const ctx = {
      org,
      tenant,
      user,
      isAdmin: true,
      permissions: new Set([
        "accounting.manage",
        "payment.record",
        "asset.manage",
        "asset.log",
        "project.view",
      ]),
      member: null,
      tenantRole: "OWNER",
    } as unknown as OrgContext;
    try {
      await Promise.all([
        db.$transaction((tx) => ensureOrgChart(tx, org.id, user.id)),
        db.$transaction((tx) => ensureOrgChart(tx, secondOrg.id, user.id)),
      ]);
      assert.equal(
        await db.accountTemplate.count({ where: { tenantId: tenant.id } }),
        SYSTEM_ACCOUNTS.length,
      );

      const [voided, history] = await Promise.all([
        rollbackAfter(async (tx) => {
          await voidPayment(tx, ctx, payment.id, "concurrency test");
          const source = await tx.accountingSource.findUniqueOrThrow({
            where: {
              organizationId_sourceType_sourceId: {
                organizationId: org.id,
                sourceType: "PAYMENT",
                sourceId: payment.id,
              },
            },
          });
          const entries = await tx.journalEntry.findMany({
            where: { organizationId: org.id, accountingSourceId: source.id },
            include: { reversal: { select: { id: true } } },
          });
          return {
            currentEntryId: source.currentEntryId,
            entries: entries.length,
            reversed: entries.some((entry) => entry.reversal !== null),
          };
        }),
        rollbackAfter((tx) =>
          syncAccountingHistoryBatch(tx, ctx, {
            organizationId: org.id,
            category: "payment",
            afterId: "",
          }),
        ),
      ]);
      assert.equal(voided.currentEntryId, null);
      assert.equal(voided.entries, 1);
      assert.equal(voided.reversed, true);
      assert.equal(history.sources, 1);

      const { saveAllocation } = await import(
        "@/modules/assets/server/registry-service"
      );
      const allocation = (projectId: string) =>
        db.$transaction((tx) =>
          saveAllocation(tx, ctx, {
            assetId: asset.id,
            projectId,
            startDate: "2026-02-01",
            endDate: "2026-02-28",
          }),
        );
      const allocations = await Promise.allSettled([
        allocation(project.id),
        allocation(project.id),
      ]);
      assert.equal(
        allocations.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        allocations.filter((result) => result.status === "rejected").length,
        1,
      );

      const savedAllocationResult = allocations.find(
        (result) => result.status === "fulfilled",
      );
      if (savedAllocationResult?.status !== "fulfilled")
        throw new Error("No allocation was created in the concurrency race.");
      const savedAllocation = savedAllocationResult.value;
      const { saveTrip } = await import("@/modules/assets/server/log-service");
      const { deleteAllocation } = await import(
        "@/modules/assets/server/registry-service"
      );
      const logAndDelete = await Promise.allSettled([
        db.$transaction((tx) =>
          saveTrip(tx, ctx, {
            assetId: asset.id,
            allocationId: savedAllocation.id,
            projectId: project.id,
            outAt: "2026-02-03T09:00:00Z",
            inAt: "2026-02-03T10:00:00Z",
            startReading: "0",
            endReading: "0",
          }),
        ),
        db.$transaction((tx) => deleteAllocation(tx, ctx, savedAllocation.id)),
      ]);
      assert.equal(
        logAndDelete.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        logAndDelete.filter((result) => result.status === "rejected").length,
        1,
      );

      const { saveGoodsReceipt } = await import(
        "@/modules/procurement/server/receipt-service"
      );
      const { changePurchaseOrderStatus } = await import(
        "@/modules/procurement/server/order-terminal-service"
      );
      const procurementContext = {
        ...ctx,
        project,
      } as OrgContext & { project: typeof project };
      const poLineId = order.lines[0]?.id;
      assert.ok(poLineId);
      const receiptAndClose = await Promise.allSettled([
        db.$transaction((tx) =>
          saveGoodsReceipt(tx, ctx, {
            id: null,
            projectId: project.id,
            poId: order.id,
            siteId: null,
            receivedDate: new Date("2026-02-04T00:00:00.000Z"),
            exchangeRate: null,
            challanNumber: null,
            vehicleNumber: null,
            lines: [
              {
                poLineId,
                receivedQty: "1",
                acceptedQty: "1",
                rejectedQty: "0",
                uomId: uom.id,
                remarks: "",
              },
            ],
          }),
        ),
        db.$transaction((tx) =>
          changePurchaseOrderStatus(tx, procurementContext, {
            id: order.id,
            action: "CLOSE",
          }),
        ),
      ]);
      assert.equal(
        receiptAndClose.filter((result) => result.status === "fulfilled")
          .length,
        1,
      );
      assert.equal(
        receiptAndClose.filter((result) => result.status === "rejected").length,
        1,
      );

      // The receipt/closure race starts with an unreceived order; this independent
      // fixture stage supplies its billed quantity before the approval/history race.
      await db.purchaseOrderLine.update({
        where: { id: poLineId },
        data: { receivedQty: 1 },
      });
      // Hold the history lock while the real approval handler queues on it.
      // Releasing only after PostgreSQL reports the waiter reproduces the
      // linked-PO approval/history lock ordering without timing sleeps.
      const { lockAccountingScope } = await import("./locking");
      const { onApproved } = await import(
        "@/modules/vendor-bill/server/approval"
      );
      let releaseHistory!: () => void;
      let acquiredHistory!: () => void;
      const historyHeld = new Promise<void>((resolve) => {
        acquiredHistory = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseHistory = resolve;
      });
      const historyTx = db.$transaction(
        async (tx) => {
          await lockAccountingScope(tx, org.id);
          acquiredHistory();
          await release;
          return syncAccountingHistoryBatch(tx, ctx, {
            organizationId: org.id,
            category: "bill",
            afterId: "",
          });
        },
        { timeout: 30_000 },
      );
      await historyHeld;
      let approvalPid: number | undefined;
      let signalApprovalStarted!: () => void;
      const approvalStarted = new Promise<void>((resolve) => {
        signalApprovalStarted = resolve;
      });
      const approvalTx = db.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          approvalPid = rows[0]?.pid;
          assert.ok(approvalPid);
          signalApprovalStarted();
          await onApproved(approvalRequest, tx, user.id);
        },
        { timeout: 30_000 },
      );
      try {
        await approvalStarted;
        const deadline = Date.now() + 10_000;
        let waiting = false;
        while (Date.now() < deadline && !waiting) {
          const rows = await db.$queryRaw<{ waiting: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_locks
              WHERE pid = ${approvalPid ?? -1} AND locktype = 'advisory'
                AND NOT granted
            ) AS waiting`;
          waiting = rows[0]?.waiting ?? false;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(waiting, true, "approval must queue behind history lock");
      } finally {
        releaseHistory();
      }
      const [historyResult] = await Promise.all([historyTx, approvalTx]);
      assert.equal(historyResult.sources, 1);
      const approvedBill = await db.vendorBill.findUniqueOrThrow({
        where: { id: bill.id },
      });
      assert.equal(approvedBill.status, "APPROVED");
      const linkedSource = await db.accountingSource.findUniqueOrThrow({
        where: {
          organizationId_sourceType_sourceId: {
            organizationId: org.id,
            sourceType: "VENDOR_BILL",
            sourceId: bill.id,
          },
        },
      });
      assert.ok(linkedSource.currentEntryId);
      assert.equal(
        await db.journalEntry.count({
          where: { accountingSourceId: linkedSource.id, status: "POSTED" },
        }),
        1,
      );
    } finally {
      await db.$transaction((tx) => cleanupTenant(tx, tenant.id, user.id));
      await db.$disconnect();
      hooks.deregister();
    }
  },
);
