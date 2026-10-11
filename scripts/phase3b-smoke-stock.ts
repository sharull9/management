import assert from "node:assert/strict";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { createFixture } from "./phase3b-smoke-fixture";

export async function stockSmoke(
  db: PrismaClient,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  approve: (id: string) => Promise<void>,
) {
  const { projects, ctx, vendor, selection, uom, tax, org, p1, p2 } = fixture;
  const { savePurchaseRequest } = await import(
    "@/modules/procurement/server/request-service"
  );
  const {
    requestInput,
    orderInput,
    receiptInput,
    consumptionInput,
    transferInput,
  } = await import("@/modules/procurement/schema");
  const { submitDocument } = await import(
    "@/modules/procurement/server/submission"
  );
  const { savePurchaseOrder } = await import(
    "@/modules/procurement/server/order-service"
  );
  const { saveGoodsReceipt } = await import(
    "@/modules/procurement/server/receipt-service"
  );
  const { recordConsumption, saveStockTransfer } = await import(
    "@/modules/procurement/server/inventory/service"
  );
  const { validateProjectCostRecognitionChange } = await import(
    "@/modules/project-cost/server/cost-recognition"
  );
  const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
    db.$transaction(fn, { timeout: 30000 });
  const cost = async (projectId: string) =>
    (
      await db.costEntry.aggregate({
        where: { projectId },
        _sum: { amount: true },
      })
    )._sum.amount?.toFixed(2) ?? "0.00";
  const orders: { po: { id: string }; poLine: { id: string } }[] = [];
  for (const project of projects) {
    const pr = await transaction((tx) =>
      savePurchaseRequest(
        tx,
        ctx,
        requestInput.parse({
          id: null,
          projectId: project.id,
          stageId: null,
          taskId: null,
          neededBy: null,
          lines: [{ ...selection, qty: "20", estimatedRate: "100" }],
        }),
      ),
    );
    await approve(
      (await transaction((tx) => submitDocument(tx, ctx, "requests", pr.id)))
        .id,
    );
    const prLine = await db.purchaseRequestLine.findFirstOrThrow({
      where: { requestId: pr.id },
    });
    const po = await transaction((tx) =>
      savePurchaseOrder(
        tx,
        ctx,
        orderInput.parse({
          id: null,
          projectId: project.id,
          vendorPartyId: vendor.id,
          siteId: null,
          date: "2026-09-01",
          paymentTerms: "CREDIT",
          paymentDays: 30,
          currency: "INR",
          receiptTolerancePercent: "0",
          lines: [
            {
              ...selection,
              qty: "20",
              rate: "100",
              discountPercent: "0",
              taxGroupId: tax.id,
              prLineId: prLine.id,
            },
          ],
        }),
      ),
    );
    await approve(
      (await transaction((tx) => submitDocument(tx, ctx, "orders", po.id))).id,
    );
    const poLine = await db.purchaseOrderLine.findFirstOrThrow({
      where: { orderId: po.id },
    });
    const grn = await transaction((tx) =>
      saveGoodsReceipt(
        tx,
        ctx,
        receiptInput.parse({
          id: null,
          projectId: project.id,
          poId: po.id,
          siteId: null,
          receivedDate: "2026-09-02",
          challanNumber: null,
          vehicleNumber: null,
          lines: [
            {
              poLineId: poLine.id,
              receivedQty: "10",
              acceptedQty: "10",
              rejectedQty: "0",
              uomId: uom.id,
            },
          ],
        }),
      ),
    );
    await approve(
      (await transaction((tx) => submitDocument(tx, ctx, "receipts", grn.id)))
        .id,
    );
    assert.equal(
      (await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } }))
        .status,
      "PARTIALLY_RECEIVED",
    );
    orders.push({ po, poLine });
  }
  assert.equal(await cost(p1.id), "1000.00");
  assert.equal(await cost(p2.id), "0.00");
  console.log(
    "Receipts: P1 cost 1000.00; P2 cost 0.00; both PO received 10/20.",
  );
  for (const project of projects)
    await transaction((tx) =>
      recordConsumption(
        tx,
        ctx,
        consumptionInput.parse({
          projectId: project.id,
          stageId: null,
          taskId: null,
          date: "2026-09-03",
          lines: [{ ...selection, qty: "2" }],
        }),
      ),
    );
  assert.equal(await cost(p1.id), "1000.00");
  assert.equal(await cost(p2.id), "200.00");
  const transfer = await transaction((tx) =>
    saveStockTransfer(
      tx,
      ctx,
      transferInput.parse({
        id: null,
        projectId: p1.id,
        toProjectId: p2.id,
        date: "2026-09-04",
        lines: [{ ...selection, qty: "3" }],
      }),
    ),
  );
  await approve(
    (
      await transaction((tx) =>
        submitDocument(tx, ctx, "transfers", transfer.id),
      )
    ).id,
  );
  assert.equal(await cost(p1.id), "700.00");
  assert.equal(await cost(p2.id), "200.00");
  await assert.rejects(
    transaction((tx) =>
      validateProjectCostRecognitionChange(
        tx,
        org.id,
        p1.id,
        "ON_CONSUMPTION",
        false,
      ),
    ),
    /Confirm.*future transactions/,
  );
  assert.equal(
    await transaction((tx) =>
      validateProjectCostRecognitionChange(
        tx,
        org.id,
        p1.id,
        "ON_CONSUMPTION",
        true,
      ),
    ),
    "ON_RECEIPT",
  );
  console.log(
    "Consumption: P1 adds 0.00; P2 adds 200.00. Transfer: P1 -300.00; P2 adds 0.00. Unconfirmed setting switch rejected.",
  );

  return orders;
}
