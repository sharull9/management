import assert from "node:assert/strict";
import test from "node:test";
import {
  expectSourceCurrent,
  postedLines,
  sourceTestBase,
} from "./source-test-fixtures";
import { withAccountingTestDatabase } from "./test-database";

test(
  "accounting source adapters preserve source balances, retries, and bill receipt reservations",
  { skip: process.env.ACCOUNTING_DB_TEST !== "local-only" },
  async () => {
    await withAccountingTestDatabase(async (tx) => {
      const { org, tenant, user, party, project } = await sourceTestBase(tx);
      const { ensureOrgChart } = await import("./chart-service");
      const { syncStockMovementJournal } = await import("./source-stock");
      const { syncVendorBillJournal } = await import("./source-procurement");
      await ensureOrgChart(tx, org.id, user.id);

      // All four stock source types use the signed base stock value exactly once.
      const group = await tx.uomGroup.create({
        data: {
          tenantId: tenant.id,
          key: `ea-${crypto.randomUUID()}`,
          name: "Count",
        },
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
          code: "MAT",
          name: "Material",
          type: "PRODUCT",
          stockUomId: uom.id,
        },
      });
      const variant = await tx.itemVariant.create({
        data: { itemId: item.id, key: `${item.id}-default` },
      });
      for (const [type, debitKey, creditKey] of [
        ["GRN_IN", "INVENTORY", "GRNI"],
        ["CONSUMPTION_OUT", "MATERIAL_EXPENSE", "INVENTORY"],
        ["TRANSFER_OUT", "TRANSFER_CLEARING", "INVENTORY"],
        ["TRANSFER_IN", "INVENTORY", "TRANSFER_CLEARING"],
        ["SALE_OUT", "COST_OF_GOODS_SOLD", "INVENTORY"],
      ] as const) {
        const outbound =
          type === "CONSUMPTION_OUT" ||
          type === "TRANSFER_OUT" ||
          type === "SALE_OUT";
        const movement = await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            itemVariantId: variant.id,
            date: new Date("2026-02-01"),
            type,
            qty: outbound ? -2 : 2,
            unitCost: 12.5,
            totalCost: outbound ? -25 : 25,
            sourceType: "INTEGRATION_TEST",
            sourceId: `${type}-${crypto.randomUUID()}`,
          },
        });
        await syncStockMovementJournal(tx, org.id, movement.id, user.id);
        const lines = await expectSourceCurrent(
          tx,
          org.id,
          "STOCK_MOVEMENT",
          movement.id,
          debitKey,
          "25.00",
          "0.00",
        );
        assert.equal(
          lines
            .filter((line) => line.account.systemKey === creditKey)
            .reduce((n, line) => n + Number(line.credit), 0)
            .toFixed(2),
          "25.00",
        );
        const count = await tx.journalEntry.count({
          where: {
            source: {
              organizationId: org.id,
              sourceType: "STOCK_MOVEMENT",
              sourceId: movement.id,
            },
          },
        });
        await syncStockMovementJournal(tx, org.id, movement.id, user.id);
        assert.equal(
          await tx.journalEntry.count({
            where: {
              source: {
                organizationId: org.id,
                sourceType: "STOCK_MOVEMENT",
                sourceId: movement.id,
              },
            },
          }),
          count,
        );
      }

      // GRN and two partial accepted-receipt bills. Repeating history/sync must not
      // move the first bill's reserved receipt quantity behind the later bill.
      const order = await tx.purchaseOrder.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          code: "PO-SRC",
          vendorPartyId: party.id,
          date: new Date("2026-01-01"),
          currency: "INR",
          subtotal: 100,
          taxTotal: 0,
          withholdingTotal: 0,
          grandTotal: 100,
          createdById: user.id,
        },
      });
      const poLine = await tx.purchaseOrderLine.create({
        data: {
          orderId: order.id,
          itemVariantId: variant.id,
          description: "Material",
          qty: 10,
          uomId: uom.id,
          rate: 10,
          discountPercent: 0,
          netAmount: 100,
          netRate: 10,
          stockFactor: 1,
          stockUomId: uom.id,
          receivedQty: 10,
          acceptedQty: 10,
        },
      });
      const receipt = await tx.goodsReceipt.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          code: "GR-SRC",
          poId: order.id,
          currency: "INR",
          receivedDate: new Date("2026-01-02"),
          receivedById: user.id,
          status: "APPROVED",
        },
      });
      const receiptLine = await tx.goodsReceiptLine.create({
        data: {
          receiptId: receipt.id,
          poLineId: poLine.id,
          receivedQty: 10,
          acceptedQty: 10,
          rejectedQty: 0,
          uomId: uom.id,
        },
      });
      const grnMovement = await tx.stockMovement.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          itemVariantId: variant.id,
          date: new Date("2026-01-02"),
          type: "GRN_IN",
          qty: 10,
          unitCost: 10,
          totalCost: 100,
          sourceType: "GRN",
          sourceId: receiptLine.id,
        },
      });
      await syncStockMovementJournal(tx, org.id, grnMovement.id, user.id);
      const bill = async (
        code: string,
        qty: number,
        amount: number,
        grnLineId: string | null,
      ) => {
        const row = await tx.vendorBill.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            partyId: party.id,
            code,
            date: new Date("2026-01-03"),
            vendorInvoiceNo: code,
            vendorInvoiceDate: new Date("2026-01-03"),
            currency: "INR",
            subtotal: amount,
            taxTotal: 0,
            grandTotal: amount,
            payableTotal: amount,
            baseSubtotal: amount,
            baseGrandTotal: amount,
            basePayableTotal: amount,
            purchaseOrderId: order.id,
            createdById: user.id,
            status: "APPROVED",
          },
        });
        await tx.vendorBillLine.create({
          data: {
            billId: row.id,
            poLineId: poLine.id,
            grnLineId,
            description: code,
            qty,
            uomId: uom.id,
            rate: amount / qty,
            lineSubtotal: amount,
            lineTax: 0,
            lineTotal: amount,
          },
        });
        return row;
      };
      const firstBill = await bill("BILL-PART-1", 4, 20, receiptLine.id);
      const secondBill = await bill("BILL-PART-2", 8, 80, receiptLine.id);
      await syncVendorBillJournal(tx, org.id, firstBill.id, user.id);
      await syncVendorBillJournal(tx, org.id, secondBill.id, user.id);
      const firstBillLines = await expectSourceCurrent(
        tx,
        org.id,
        "VENDOR_BILL",
        firstBill.id,
        "GRNI",
        "40.00",
        "0.00",
      );
      assert.equal(
        firstBillLines
          .find((line) => line.account.systemKey === "PURCHASE_VARIANCE")
          ?.credit.toFixed(2),
        "20.00",
      );
      await expectSourceCurrent(
        tx,
        org.id,
        "VENDOR_BILL",
        secondBill.id,
        "GRNI",
        "60.00",
        "0.00",
      );
      await syncVendorBillJournal(tx, org.id, firstBill.id, user.id);
      await syncVendorBillJournal(tx, org.id, secondBill.id, user.id);
      await expectSourceCurrent(
        tx,
        org.id,
        "VENDOR_BILL",
        firstBill.id,
        "GRNI",
        "40.00",
        "0.00",
      );
      await expectSourceCurrent(
        tx,
        org.id,
        "VENDOR_BILL",
        secondBill.id,
        "GRNI",
        "60.00",
        "0.00",
      );

      const rejectedReceipt = await tx.goodsReceipt.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          code: "GR-REJECT",
          poId: order.id,
          currency: "INR",
          receivedDate: new Date("2026-01-04"),
          receivedById: user.id,
          status: "APPROVED",
        },
      });
      const rejectedLine = await tx.goodsReceiptLine.create({
        data: {
          receiptId: rejectedReceipt.id,
          poLineId: poLine.id,
          receivedQty: 2,
          acceptedQty: 0,
          rejectedQty: 2,
          uomId: uom.id,
        },
      });
      const rejectedBill = await bill("BILL-REJECT", 2, 30, rejectedLine.id);
      await syncVendorBillJournal(tx, org.id, rejectedBill.id, user.id);
      const rejectedPosting = await postedLines(
        tx,
        org.id,
        "VENDOR_BILL",
        rejectedBill.id,
      );
      assert.equal(
        rejectedPosting
          .find((line) => line.account.systemKey === "OTHER_EXPENSE")
          ?.debit.toFixed(2),
        "30.00",
      );
      assert.equal(
        rejectedPosting.some((line) => line.account.systemKey === "GRNI"),
        false,
      );
      const directBill = await tx.vendorBill.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          partyId: party.id,
          code: "BILL-DIRECT",
          date: new Date("2026-01-05"),
          vendorInvoiceNo: "DIRECT",
          vendorInvoiceDate: new Date("2026-01-05"),
          currency: "INR",
          subtotal: 15,
          taxTotal: 0,
          grandTotal: 15,
          payableTotal: 15,
          baseSubtotal: 15,
          baseGrandTotal: 15,
          basePayableTotal: 15,
          createdById: user.id,
          status: "APPROVED",
        },
      });
      await tx.vendorBillLine.create({
        data: {
          billId: directBill.id,
          description: "direct service",
          qty: 1,
          uomId: uom.id,
          rate: 15,
          lineSubtotal: 15,
          lineTax: 0,
          lineTotal: 15,
        },
      });
      await syncVendorBillJournal(tx, org.id, directBill.id, user.id);
      const directPosting = await postedLines(
        tx,
        org.id,
        "VENDOR_BILL",
        directBill.id,
      );
      assert.equal(
        directPosting
          .find((line) => line.account.systemKey === "OTHER_EXPENSE")
          ?.debit.toFixed(2),
        "15.00",
      );

      const centOrder = await tx.purchaseOrder.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          code: "PO-CENT-ACCRUAL",
          vendorPartyId: party.id,
          date: new Date("2026-01-10"),
          currency: "INR",
          subtotal: 1,
          taxTotal: 0,
          withholdingTotal: 0,
          grandTotal: 1,
          createdById: user.id,
        },
      });
      const centPoLine = await tx.purchaseOrderLine.create({
        data: {
          orderId: centOrder.id,
          itemVariantId: variant.id,
          description: "Fractional material",
          qty: 3,
          uomId: uom.id,
          rate: 0.33,
          discountPercent: 0,
          netAmount: 1,
          netRate: 0.33,
          stockFactor: 1,
          stockUomId: uom.id,
          receivedQty: 3,
          acceptedQty: 3,
        },
      });
      const centReceipt = await tx.goodsReceipt.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          code: "GR-CENT-ACCRUAL",
          poId: centOrder.id,
          currency: "INR",
          receivedDate: new Date("2026-01-11"),
          receivedById: user.id,
          status: "APPROVED",
        },
      });
      const centReceiptLine = await tx.goodsReceiptLine.create({
        data: {
          receiptId: centReceipt.id,
          poLineId: centPoLine.id,
          receivedQty: 3,
          acceptedQty: 3,
          rejectedQty: 0,
          uomId: uom.id,
        },
      });
      await tx.stockMovement.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          itemVariantId: variant.id,
          date: new Date("2026-01-11"),
          type: "GRN_IN",
          qty: 3,
          unitCost: 0.333333,
          totalCost: 1,
          sourceType: "GRN",
          sourceId: centReceiptLine.id,
        },
      });
      const centBills: { id: string }[] = [];
      for (let index = 0; index < 3; index++) {
        const row = await tx.vendorBill.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            partyId: party.id,
            code: `BILL-CENT-${index}`,
            date: new Date(`2026-01-${12 + index}`),
            vendorInvoiceNo: `CENT-${index}`,
            vendorInvoiceDate: new Date(`2026-01-${12 + index}`),
            currency: "INR",
            subtotal: 0.33,
            taxTotal: 0,
            grandTotal: 0.33,
            payableTotal: 0.33,
            baseSubtotal: 0.33,
            baseGrandTotal: 0.33,
            basePayableTotal: 0.33,
            purchaseOrderId: centOrder.id,
            createdById: user.id,
            status: "APPROVED",
          },
        });
        await tx.vendorBillLine.create({
          data: {
            billId: row.id,
            poLineId: centPoLine.id,
            description: `Fractional material ${index}`,
            qty: 1,
            uomId: uom.id,
            rate: 0.33,
            lineSubtotal: 0.33,
            lineTax: 0,
            lineTotal: 0.33,
          },
        });
        centBills.push(row);
      }
      for (const row of centBills)
        await syncVendorBillJournal(tx, org.id, row.id, user.id);
      const centPostings = await Promise.all(
        centBills.map((row) => postedLines(tx, org.id, "VENDOR_BILL", row.id)),
      );
      assert.equal(
        centPostings
          .flat()
          .filter((line) => line.account.systemKey === "GRNI")
          .reduce((sum, line) => sum + Number(line.debit), 0)
          .toFixed(2),
        "1.00",
      );
      assert.equal(
        centPostings
          .flat()
          .filter((line) => line.account.systemKey === "PURCHASE_VARIANCE")
          .reduce((sum, line) => sum + Number(line.credit), 0)
          .toFixed(2),
        "0.01",
      );

      const reservationOrder = await tx.purchaseOrder.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          code: "PO-EXPLICIT-PRIORITY",
          vendorPartyId: party.id,
          date: new Date("2026-01-20"),
          currency: "INR",
          subtotal: 20,
          taxTotal: 0,
          withholdingTotal: 0,
          grandTotal: 20,
          createdById: user.id,
        },
      });
      const reservationPoLine = await tx.purchaseOrderLine.create({
        data: {
          orderId: reservationOrder.id,
          itemVariantId: variant.id,
          description: "Reserved material",
          qty: 2,
          uomId: uom.id,
          rate: 10,
          discountPercent: 0,
          netAmount: 20,
          netRate: 10,
          stockFactor: 1,
          stockUomId: uom.id,
          receivedQty: 2,
          acceptedQty: 2,
        },
      });
      const reservationReceipts: { id: string }[] = [];
      for (const [index, cost] of [10, 20].entries()) {
        const receipt = await tx.goodsReceipt.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            code: `GR-PRIORITY-${index}`,
            poId: reservationOrder.id,
            currency: "INR",
            receivedDate: new Date(`2026-01-${21 + index}`),
            receivedById: user.id,
            status: "APPROVED",
          },
        });
        const receiptLine = await tx.goodsReceiptLine.create({
          data: {
            receiptId: receipt.id,
            poLineId: reservationPoLine.id,
            receivedQty: 1,
            acceptedQty: 1,
            rejectedQty: 0,
            uomId: uom.id,
          },
        });
        await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            itemVariantId: variant.id,
            date: receipt.receivedDate,
            type: "GRN_IN",
            qty: 1,
            unitCost: cost,
            totalCost: cost,
            sourceType: "GRN",
            sourceId: receiptLine.id,
          },
        });
        reservationReceipts.push(receiptLine);
      }
      const priorityBill = async (
        code: string,
        day: number,
        grnLineId: string | null,
      ) => {
        const row = await tx.vendorBill.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            partyId: party.id,
            code,
            date: new Date(`2026-01-${day}`),
            vendorInvoiceNo: code,
            vendorInvoiceDate: new Date(`2026-01-${day}`),
            currency: "INR",
            subtotal: 10,
            taxTotal: 0,
            grandTotal: 10,
            payableTotal: 10,
            baseSubtotal: 10,
            baseGrandTotal: 10,
            basePayableTotal: 10,
            purchaseOrderId: reservationOrder.id,
            createdById: user.id,
            status: "APPROVED",
          },
        });
        await tx.vendorBillLine.create({
          data: {
            billId: row.id,
            poLineId: reservationPoLine.id,
            grnLineId,
            description: code,
            qty: 1,
            uomId: uom.id,
            rate: 10,
            lineSubtotal: 10,
            lineTax: 0,
            lineTotal: 10,
          },
        });
        return row;
      };
      const genericBill = await priorityBill("BILL-GENERIC-FIRST", 20, null);
      const explicitReceiptId = reservationReceipts[0]?.id;
      if (!explicitReceiptId) throw new Error("Expected an accepted receipt.");
      const explicitBill = await priorityBill(
        "BILL-EXPLICIT-LATER",
        24,
        explicitReceiptId,
      );
      await syncVendorBillJournal(tx, org.id, genericBill.id, user.id);
      await syncVendorBillJournal(tx, org.id, explicitBill.id, user.id);
      assert.equal(
        (
          await postedLines(tx, org.id, "VENDOR_BILL", genericBill.id).then(
            (lines) =>
              lines.find((line) => line.account.systemKey === "GRNI")?.debit,
          )
        )?.toFixed(2),
        "20.00",
      );
      assert.equal(
        (
          await postedLines(tx, org.id, "VENDOR_BILL", explicitBill.id).then(
            (lines) =>
              lines.find((line) => line.account.systemKey === "GRNI")?.debit,
          )
        )?.toFixed(2),
        "10.00",
      );
    });
  },
);
