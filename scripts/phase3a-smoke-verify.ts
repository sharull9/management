import { Decimal } from "@/core/decimal";
import "dotenv/config";
import assert from "node:assert/strict";
import { permissionKeys } from "@/core/permissions";
import { getApprovalHandler } from "@/modules/approvals/server/handlers";
import "@/modules/approvals/server/register";
import type { OrgContext } from "@/core/context";
import { db } from "@/core/db";
import { resolveVariant } from "@/modules/masters/server/service";
import {
  consumptionInput,
  orderInput,
  receiptInput,
  transferInput,
} from "@/modules/procurement/schema";
import {
  recordConsumption,
  saveStockTransfer,
  stockBalance,
} from "@/modules/procurement/server/inventory/service";
import { savePurchaseOrder } from "@/modules/procurement/server/order-service";
import { saveGoodsReceipt } from "@/modules/procurement/server/receipt-service";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.PHASE3A_SMOKE_CONFIRM !== "local-only" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error(
      "Set a local DATABASE_URL and PHASE3A_SMOKE_CONFIRM=local-only.",
    );
  try {
    const org = await db.organization.findUniqueOrThrow({
      where: { slug: "phase3a" },
      include: { tenant: true },
    });
    const user = await db.user.findUniqueOrThrow({
      where: { email: "phase3a@example.test" },
    });
    const ctx = {
      user,
      org,
      tenant: org.tenant,
      member: null,
      tenantRole: "OWNER",
      permissions: new Set(permissionKeys),
      isAdmin: true,
    } as unknown as OrgContext;
    const from = await db.project.findUniqueOrThrow({
        where: {
          organizationId_code: { organizationId: org.id, code: "PRJ-SMOKE-A" },
        },
      }),
      to = await db.project.findUniqueOrThrow({
        where: {
          organizationId_code: { organizationId: org.id, code: "PRJ-SMOKE-B" },
        },
      });
    const variant = await db.itemVariant.findFirstOrThrow({
      where: { item: { tenantId: org.tenantId, code: "CEMENT" } },
      include: { item: { include: { stockUom: true, purchaseUom: true } } },
    });
    assert.equal(variant.name, "Cement · UltraTech · 53 Grade");
    const po = await db.purchaseOrder.findUniqueOrThrow({
      where: {
        organizationId_code: { organizationId: org.id, code: "PO-0001" },
      },
      include: { lines: { include: { taxes: true } } },
    });
    assert.equal(po.status, "RECEIVED");
    assert.equal(po.subtotal.toFixed(2), "8000.00");
    assert.equal(po.taxTotal.toFixed(2), "1440.00");
    assert.equal(po.grandTotal.toFixed(2), "9440.00");
    assert.equal(po.lines[0].receivedQty.toString(), "20");
    assert.equal(po.lines[0].acceptedQty.toString(), "20");
    assert.equal(po.lines[0].taxes.length, 2);
    const receipts = await db.goodsReceipt.findMany({
      where: { organizationId: org.id },
      include: { lines: true },
      orderBy: { code: "asc" },
    });
    assert.equal(receipts.length, 2);
    assert.ok(receipts.every((r) => r.status === "APPROVED"));
    assert.deepEqual(
      receipts.map((r) => r.lines[0].acceptedQty.toString()),
      ["8", "12"],
    );
    const incoming = await db.stockMovement.findMany({
      where: { organizationId: org.id, type: "GRN_IN" },
      orderBy: { createdAt: "asc" },
    });
    assert.deepEqual(
      incoming.map((m) => m.qty.toString()),
      ["400", "600"],
    );
    assert.ok(incoming.every((m) => m.unitCost.toString() === "8"));
    const costs = await db.costEntry.findMany({
      where: { organizationId: org.id },
    });
    assert.equal(costs.length, 1);
    assert.equal(costs[0].sourceType, "CONSUMPTION");
    assert.equal(costs[0].costType, "MATERIAL");
    assert.equal(costs[0].amount.toFixed(2), "800.00");
    assert.equal(costs[0].stageId, "phase3a-stage");
    assert.equal(costs[0].taskId, "phase3a-task");
    const balances = await db.$transaction(async (tx) => ({
      from: await stockBalance(tx, org.id, from.id, variant.id),
      to: await stockBalance(tx, org.id, to.id, variant.id),
    }));
    assert.equal(balances.from.qty.toString(), "700");
    assert.equal(balances.from.value.toFixed(2), "5600.00");
    assert.equal(balances.to.qty.toString(), "200");
    assert.equal(balances.to.value.toFixed(2), "1600.00");
    const transfer = await db.stockTransfer.findUniqueOrThrow({
      where: {
        organizationId_code: { organizationId: org.id, code: "ST-0001" },
      },
    });
    assert.equal(transfer.status, "APPROVED");
    const transfers = await db.stockMovement.findMany({
      where: { organizationId: org.id, sourceType: "TRANSFER" },
    });
    assert.equal(transfers.length, 2);
    assert.equal(
      transfers.reduce((a, m) => a.add(m.qty), new Decimal(0)).toString(),
      "0",
    );
    assert.equal(
      transfers.reduce((a, m) => a.add(m.totalCost), new Decimal(0)).toString(),
      "0",
    );
    assert.equal(
      await db.approvalRequest.count({
        where: { organizationId: org.id, status: "PENDING" },
      }),
      0,
    );
    assert.equal(
      await db.auditLog.count({
        where: {
          organizationId: org.id,
          entityType: "StockMovement",
          action: "CREATE",
        },
      }),
      5,
    );
    const levels = [
      variant.level1Id,
      variant.level2Id,
      variant.level3Id,
      variant.level4Id,
      variant.level5Id,
    ];
    const line = {
      itemId: variant.itemId,
      levels,
      qty: "701",
      uomId: variant.item.stockUomId,
    };
    const before = await db.stockMovement.count({
      where: { organizationId: org.id },
    });
    await assert.rejects(
      db.$transaction((tx) =>
        recordConsumption(
          tx,
          ctx,
          consumptionInput.parse({
            projectId: from.id,
            stageId: "phase3a-stage",
            taskId: "phase3a-task",
            date: "2026-10-10",
            lines: [line],
          }),
        ),
      ),
      /Insufficient stock/,
    );
    assert.equal(
      await db.materialConsumption.count({ where: { organizationId: org.id } }),
      1,
    );
    await assert.rejects(
      db.$transaction((tx) =>
        recordConsumption(
          tx,
          ctx,
          consumptionInput.parse({
            projectId: from.id,
            stageId: null,
            taskId: null,
            date: "2026-10-09",
            lines: [{ ...line, qty: "1" }],
          }),
        ),
      ),
      /cannot predate/,
    );
    await assert.rejects(
      db.$transaction((tx) =>
        recordConsumption(
          tx,
          ctx,
          consumptionInput.parse({
            projectId: to.id,
            stageId: "phase3a-stage",
            taskId: null,
            date: "2026-10-10",
            lines: [{ ...line, qty: "1" }],
          }),
        ),
      ),
    );
    const approval = await db.approvalRequest.findUniqueOrThrow({
      where: { id: receipts[0].approvalRequestId ?? "" },
    });
    await assert.rejects(
      db.$transaction(
        (tx) =>
          getApprovalHandler("GRN")?.onApproved(approval, tx, user.id) ??
          Promise.resolve(),
      ),
      /no longer matches/,
    );
    await assert.rejects(
      db.$transaction((tx) =>
        saveGoodsReceipt(
          tx,
          ctx,
          receiptInput.parse({
            id: null,
            projectId: from.id,
            poId: po.id,
            siteId: null,
            receivedDate: "2026-10-10",
            challanNumber: null,
            vehicleNumber: null,
            lines: [
              {
                poLineId: po.lines[0].id,
                receivedQty: "1",
                acceptedQty: "1",
                rejectedQty: "0",
                uomId: po.lines[0].uomId,
              },
            ],
          }),
        ),
      ),
    );
    await assert.rejects(
      db.$transaction((tx) =>
        savePurchaseOrder(
          tx,
          ctx,
          orderInput.parse({
            id: null,
            projectId: to.id,
            vendorPartyId: po.vendorPartyId,
            siteId: null,
            date: "2026-10-10",
            paymentTerms: "CREDIT",
            paymentDays: 30,
            currency: "INR",
            receiptTolerancePercent: "0",
            lines: [
              {
                ...line,
                qty: "1",
                description: "",
                rate: "400",
                discountPercent: "0",
                taxGroupId: po.lines[0].taxGroupId,
                prLineId: po.lines[0].prLineId,
              },
            ],
          }),
        ),
      ),
    );
    await assert.rejects(
      db.$transaction((tx) =>
        resolveVariant(tx, org.tenantId, variant.itemId, [
          "invalid",
          variant.level2Id,
        ]),
      ),
      /Invalid Brand/,
    );
    assert.equal(
      await db.stockMovement.count({ where: { organizationId: org.id } }),
      before,
    );
    assert.equal(
      await db.costEntry.count({ where: { organizationId: org.id } }),
      1,
    );
    const resolved = await db.$transaction((tx) =>
      resolveVariant(tx, org.tenantId, variant.itemId, levels),
    );
    assert.equal(resolved.id, variant.id);
    assert.equal(
      await db.itemVariant.count({ where: { itemId: variant.itemId } }),
      1,
    );
    const rollback = new Error("rollback-extra-checks");
    try {
      await db.$transaction(
        async (tx) => {
          const sample = await tx.project.create({
            data: {
              organizationId: org.id,
              code: "PRJ-ROLLBACK-CHECK",
              name: "Rolled back checks",
              currency: "INR",
            },
          });
          const discounted = await savePurchaseOrder(
            tx,
            ctx,
            orderInput.parse({
              id: null,
              projectId: sample.id,
              vendorPartyId: po.vendorPartyId,
              siteId: null,
              date: "2026-10-10",
              paymentTerms: "CREDIT",
              paymentDays: 30,
              currency: "INR",
              receiptTolerancePercent: "0",
              lines: [
                {
                  ...line,
                  qty: "2",
                  uomId: variant.item.purchaseUomId,
                  description: "",
                  rate: "500",
                  discountPercent: "10",
                  taxGroupId: po.lines[0].taxGroupId,
                  prLineId: null,
                },
              ],
            }),
          );
          assert.equal(discounted.subtotal.toString(), "900");
          assert.equal(discounted.taxTotal.toString(), "162");
          assert.equal(discounted.grandTotal.toString(), "1062");
          await tx.purchaseOrder.update({
            where: { id: discounted.id },
            data: { status: "APPROVED" },
          });
          const discountedLine = await tx.purchaseOrderLine.findFirstOrThrow({
            where: { orderId: discounted.id },
          });
          const receipt = await saveGoodsReceipt(
            tx,
            ctx,
            receiptInput.parse({
              id: null,
              projectId: sample.id,
              poId: discounted.id,
              siteId: null,
              receivedDate: "2026-10-10",
              challanNumber: null,
              vehicleNumber: null,
              lines: [
                {
                  poLineId: discountedLine.id,
                  receivedQty: "2",
                  acceptedQty: "1.5",
                  rejectedQty: "0.5",
                  uomId: discountedLine.uomId,
                },
              ],
            }),
          );
          const request = await tx.approvalRequest.create({
            data: {
              organizationId: org.id,
              projectId: sample.id,
              documentType: "GRN",
              documentId: receipt.id,
              title: "Rollback check",
              requestedById: user.id,
            },
          });
          await tx.goodsReceipt.update({
            where: { id: receipt.id },
            data: { status: "PENDING_APPROVAL", approvalRequestId: request.id },
          });
          const handler = getApprovalHandler("GRN");
          assert.ok(handler);
          await handler.onApproved(request, tx, user.id);
          const balance = await stockBalance(tx, org.id, sample.id, variant.id);
          assert.equal(balance.qty.toString(), "75");
          assert.equal(balance.value.toString(), "675");
          assert.equal(balance.avgCost.toString(), "9");
          assert.equal(
            await tx.costEntry.count({ where: { projectId: sample.id } }),
            0,
          );
          await tx.purchaseOrder.update({
            where: { id: discounted.id },
            data: { status: "APPROVED" },
          });
          const excessive = await tx.goodsReceipt.create({
            data: {
              organizationId: org.id,
              projectId: sample.id,
              code: "GRN-ROLLBACK-OVER",
              poId: discounted.id,
              receivedDate: new Date("2026-10-10"),
              receivedById: user.id,
              lines: {
                create: {
                  poLineId: discountedLine.id,
                  receivedQty: "1",
                  acceptedQty: "1",
                  rejectedQty: "0",
                  uomId: discountedLine.uomId,
                },
              },
            },
          });
          const overRequest = await tx.approvalRequest.create({
            data: {
              organizationId: org.id,
              projectId: sample.id,
              documentType: "GRN",
              documentId: excessive.id,
              title: "Over-receipt rollback check",
              requestedById: user.id,
            },
          });
          await tx.goodsReceipt.update({
            where: { id: excessive.id },
            data: {
              status: "PENDING_APPROVAL",
              approvalRequestId: overRequest.id,
            },
          });
          await assert.rejects(
            handler.onApproved(overRequest, tx, user.id),
            /exceeds/,
          );
          await handler.onRejected(overRequest, tx, user.id);
          assert.equal(
            (
              await tx.goodsReceipt.findUniqueOrThrow({
                where: { id: excessive.id },
              })
            ).status,
            "DRAFT",
          );
          const transferred = await saveStockTransfer(
            tx,
            ctx,
            transferInput.parse({
              id: null,
              projectId: sample.id,
              toProjectId: to.id,
              date: "2026-10-10",
              lines: [{ ...line, qty: "50" }],
            }),
          );
          const transferRequest = await tx.approvalRequest.create({
            data: {
              organizationId: org.id,
              projectId: sample.id,
              documentType: "STOCK_TRANSFER",
              documentId: transferred.id,
              title: "Transfer rollback check",
              requestedById: user.id,
            },
          });
          await tx.stockTransfer.update({
            where: { id: transferred.id },
            data: {
              status: "PENDING_APPROVAL",
              approvalRequestId: transferRequest.id,
            },
          });
          const transferHandler = getApprovalHandler("STOCK_TRANSFER");
          assert.ok(transferHandler);
          await transferHandler.onApproved(transferRequest, tx, user.id);
          const destination = await stockBalance(tx, org.id, to.id, variant.id);
          assert.equal(destination.qty.toString(), "250");
          assert.equal(destination.value.toString(), "2050");
          assert.equal(destination.avgCost.toString(), "8.2");
          await recordConsumption(
            tx,
            ctx,
            consumptionInput.parse({
              projectId: sample.id,
              stageId: null,
              taskId: null,
              date: "2026-10-10",
              lines: [{ ...line, qty: "25" }],
            }),
          );
          assert.equal(
            (
              await stockBalance(tx, org.id, sample.id, variant.id)
            ).value.toString(),
            "0",
          );
          assert.equal(
            (
              await tx.costEntry.findFirstOrThrow({
                where: { projectId: sample.id },
              })
            ).amount.toString(),
            "225",
          );
          throw rollback;
        },
        { timeout: 20000 },
      );
    } catch (error) {
      assert.equal(error, rollback);
    }
    assert.equal(
      await db.project.count({
        where: { organizationId: org.id, code: "PRJ-ROLLBACK-CHECK" },
      }),
      0,
    );
    assert.equal(
      await db.stockMovement.count({ where: { organizationId: org.id } }),
      before,
    );
    console.log(
      "PASS: discounted PO, accepted/rejected GRN split, final-handler over-receipt guard, rejection to draft, transfer into a different average and complete depletion; all extra fixtures rolled back.",
    );
    console.log(
      "PASS: browser workflow persisted; PR/PO/2 GRNs approved; taxes 1440, PO 9440; source 700 kg/5600; destination 200 kg/1600; one task MATERIAL cost 800; no pending approvals; audited and unique stock sources.",
    );
    console.log(
      "PASS: insufficient stock, backdate, cross-project stage/PR, duplicate GRN decision, receipt against completed PO and invalid variant rejected; failed transactions left stock/cost unchanged; variant resolution idempotent.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
