import assert from "node:assert/strict";
import test from "node:test";
import type { OrgContext } from "@/core/context";
import {
  expectSourceCurrent,
  postedLines,
  sourceTestBase,
} from "./source-test-fixtures";
import {
  expectAccountingFailure,
  withAccountingTestDatabase,
} from "./test-database";

test(
  "accounting source history sync is retry-safe and rejects foreign organization IDs",
  { skip: process.env.ACCOUNTING_DB_TEST !== "local-only" },
  async () => {
    await withAccountingTestDatabase(async (tx) => {
      const { org, tenant, user, party, project } = await sourceTestBase(tx);
      const { syncSalesInvoiceJournal } = await import("./source-sales");
      const { syncPaymentJournals } = await import("./source-payments");
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
      const invoice = await tx.salesInvoice.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          code: "SI-SOURCE",
          date: new Date("2026-03-01"),
          currency: "INR",
          subtotal: 100,
          taxTotal: 0,
          grandTotal: 100,
          payableTotal: 100,
          baseSubtotal: 100,
          baseGrandTotal: 100,
          basePayableTotal: 100,
          createdById: user.id,
          status: "APPROVED",
          lines: {
            create: {
              description: "Consulting service",
              qty: 1,
              uomId: uom.id,
              rate: 100,
              lineSubtotal: 100,
              lineTax: 0,
              lineTotal: 100,
            },
          },
        },
      });
      const posted = await syncSalesInvoiceJournal(
        tx,
        org.id,
        invoice.id,
        user.id,
      );
      assert.equal(posted?.status, "POSTED");
      const before = await tx.journalEntry.count({
        where: {
          source: {
            organizationId: org.id,
            sourceType: "SALES_INVOICE",
            sourceId: invoice.id,
          },
        },
      });
      await syncSalesInvoiceJournal(tx, org.id, invoice.id, user.id);
      assert.equal(
        await tx.journalEntry.count({
          where: {
            source: {
              organizationId: org.id,
              sourceType: "SALES_INVOICE",
              sourceId: invoice.id,
            },
          },
        }),
        before,
      );
      const { syncAccountingHistory } = await import("./history-service");
      const ctx = {
        org,
        tenant,
        user,
        isAdmin: true,
        permissions: new Set(["accounting.manage"]),
        member: null,
        tenantRole: "OWNER",
      } as unknown as OrgContext;
      for (let index = 0; index < 11; index++)
        await tx.payment.create({
          data: {
            organizationId: org.id,
            partyId: party.id,
            projectId: project.id,
            code: `HISTORY-${index}`,
            direction: "OUTGOING",
            date: new Date("2026-03-01"),
            mode: "BANK",
            currency: "INR",
            amount: 1,
            baseAmount: 1,
            allocatedAmount: 0,
            unallocatedAmount: 1,
            status: "POSTED",
            createdById: user.id,
          },
        });
      const history = await syncAccountingHistory(tx, ctx);
      assert.ok(history.sources >= 12);
      await syncAccountingHistory(tx, ctx);
      assert.equal(
        await tx.journalEntry.count({
          where: {
            organizationId: org.id,
            source: { sourceType: "SALES_INVOICE", sourceId: invoice.id },
          },
        }),
        before,
      );
      await expectAccountingFailure(
        tx,
        () =>
          syncSalesInvoiceJournal(tx, `${org.id}-foreign`, invoice.id, user.id),
        /not found/i,
      );
      assert.equal(
        await tx.journalEntry.count({
          where: {
            organizationId: org.id,
            source: { sourceType: "SALES_INVOICE", sourceId: invoice.id },
          },
        }),
        before,
      );

      await tx.tenantCurrency.create({
        data: { tenantId: tenant.id, currencyCode: "USD" },
      });
      const foreignCurrencyPayment = await tx.payment.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          projectId: project.id,
          code: "PAY-FX",
          direction: "OUTGOING",
          date: new Date("2026-03-02"),
          mode: "BANK",
          currency: "USD",
          exchangeRate: 85,
          amount: 100,
          baseAmount: 8500,
          allocatedAmount: 0,
          unallocatedAmount: 100,
          createdById: user.id,
        },
      });
      await syncPaymentJournals(tx, org.id, foreignCurrencyPayment.id, user.id);
      await expectSourceCurrent(
        tx,
        org.id,
        "PAYMENT",
        foreignCurrencyPayment.id,
        "VENDOR_ADVANCES",
        "8500.00",
        "0.00",
      );
      const fxBill = await tx.vendorBill.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          partyId: party.id,
          code: "FX-BILL",
          date: new Date("2026-03-01"),
          vendorInvoiceNo: "FX-1",
          vendorInvoiceDate: new Date("2026-03-01"),
          currency: "USD",
          exchangeRate: 83,
          subtotal: 100,
          taxTotal: 0,
          grandTotal: 100,
          payableTotal: 100,
          baseSubtotal: 8300,
          baseGrandTotal: 8300,
          basePayableTotal: 8300,
          createdById: user.id,
          status: "APPROVED",
        },
      });
      const allocation = await tx.paymentAllocation.create({
        data: {
          paymentId: foreignCurrencyPayment.id,
          vendorBillId: fxBill.id,
          amount: 100,
          baseAmount: 8500,
          documentBaseAmount: 8300,
          fxDifference: 200,
          allocatedById: user.id,
          allocatedAt: new Date("2026-03-03"),
        },
      });
      await tx.payment.update({
        where: { id: foreignCurrencyPayment.id },
        data: { allocatedAmount: 100, unallocatedAmount: 0 },
      });
      await syncPaymentJournals(tx, org.id, foreignCurrencyPayment.id, user.id);
      const allocationLines = await expectSourceCurrent(
        tx,
        org.id,
        "PAYMENT_ALLOCATION",
        allocation.id,
        "ACCOUNTS_PAYABLE",
        "8300.00",
        "0.00",
      );
      assert.equal(
        allocationLines
          .find((line) => line.account.systemKey === "FX_LOSS")
          ?.debit.toFixed(2),
        "200.00",
      );
      const usdInvoice = await tx.salesInvoice.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          code: "SI-FX",
          date: new Date("2026-03-01"),
          currency: "USD",
          exchangeRate: 83,
          subtotal: 100,
          taxTotal: 0,
          grandTotal: 100,
          payableTotal: 100,
          baseSubtotal: 8300,
          baseGrandTotal: 8300,
          basePayableTotal: 8300,
          createdById: user.id,
          status: "APPROVED",
          lines: {
            create: {
              description: "Consulting service",
              qty: 1,
              uomId: uom.id,
              rate: 100,
              lineSubtotal: 100,
              lineTax: 0,
              lineTotal: 100,
            },
          },
        },
      });
      const incomingPayment = await tx.payment.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          projectId: project.id,
          code: "REC-FX",
          direction: "INCOMING",
          date: new Date("2026-03-02"),
          mode: "BANK",
          currency: "USD",
          exchangeRate: 85,
          amount: 100,
          baseAmount: 8500,
          allocatedAmount: 100,
          unallocatedAmount: 0,
          createdById: user.id,
        },
      });
      const incomingAllocation = await tx.paymentAllocation.create({
        data: {
          paymentId: incomingPayment.id,
          salesInvoiceId: usdInvoice.id,
          amount: 100,
          baseAmount: 8500,
          documentBaseAmount: 8300,
          fxDifference: 200,
          allocatedById: user.id,
          allocatedAt: new Date("2026-03-03"),
        },
      });
      await syncPaymentJournals(tx, org.id, incomingPayment.id, user.id);
      const incomingLines = await expectSourceCurrent(
        tx,
        org.id,
        "PAYMENT_ALLOCATION",
        incomingAllocation.id,
        "ACCOUNTS_RECEIVABLE",
        "0.00",
        "8300.00",
      );
      assert.equal(
        incomingLines
          .find((line) => line.account.systemKey === "FX_GAIN")
          ?.credit.toFixed(2),
        "200.00",
      );
      const roundingPayment = await tx.payment.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          projectId: project.id,
          code: "PAY-ROUND",
          direction: "INCOMING",
          date: new Date("2026-03-02"),
          mode: "BANK",
          currency: "INR",
          exchangeRate: 1,
          amount: 1,
          baseAmount: 1,
          allocatedAmount: 0,
          unallocatedAmount: 1,
          createdById: user.id,
        },
      });
      const roundingBill = await tx.salesInvoice.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          code: "SI-ROUND",
          date: new Date("2026-03-01"),
          currency: "INR",
          subtotal: 1,
          taxTotal: 0,
          grandTotal: 1,
          payableTotal: 1,
          baseSubtotal: 1,
          baseGrandTotal: 1,
          basePayableTotal: 1,
          createdById: user.id,
          status: "APPROVED",
          lines: {
            create: {
              description: "Consulting service",
              qty: 1,
              uomId: uom.id,
              rate: 1,
              lineSubtotal: 1,
              lineTax: 0,
              lineTotal: 1,
            },
          },
        },
      });
      await tx.paymentAllocation.create({
        data: {
          paymentId: roundingPayment.id,
          salesInvoiceId: roundingBill.id,
          amount: 1,
          baseAmount: 1.01,
          documentBaseAmount: 1,
          fxDifference: 0.01,
          allocatedById: user.id,
          allocatedAt: new Date("2026-03-03"),
        },
      });
      await tx.payment.update({
        where: { id: roundingPayment.id },
        data: { allocatedAmount: 1, unallocatedAmount: 0 },
      });
      await syncPaymentJournals(tx, org.id, roundingPayment.id, user.id);
      const rounding = await expectSourceCurrent(
        tx,
        org.id,
        "PAYMENT_ROUNDING",
        roundingPayment.id,
        "ROUNDING",
        "0.01",
        "0.00",
      );
      assert.equal(
        rounding
          .find((line) => line.account.systemKey === "CUSTOMER_ADVANCES")
          ?.credit.toFixed(2),
        "0.01",
      );

      const settledBill = await tx.vendorBill.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          partyId: party.id,
          code: "BILL-DOCUMENT-ROUND",
          date: new Date("2026-03-01"),
          vendorInvoiceNo: "ROUND-1",
          vendorInvoiceDate: new Date("2026-03-01"),
          currency: "USD",
          exchangeRate: 1.5,
          subtotal: 0.03,
          taxTotal: 0,
          grandTotal: 0.03,
          payableTotal: 0.03,
          baseSubtotal: 0.05,
          baseGrandTotal: 0.05,
          basePayableTotal: 0.05,
          createdById: user.id,
          status: "PAID",
        },
      });
      const settledInvoice = await tx.salesInvoice.create({
        data: {
          organizationId: org.id,
          partyId: party.id,
          code: "SI-DOCUMENT-ROUND",
          date: new Date("2026-03-01"),
          currency: "USD",
          exchangeRate: 1.5,
          subtotal: 0.03,
          taxTotal: 0,
          grandTotal: 0.03,
          payableTotal: 0.03,
          baseSubtotal: 0.05,
          baseGrandTotal: 0.05,
          basePayableTotal: 0.05,
          createdById: user.id,
          status: "PAID",
        },
      });
      for (const [direction, documentId, field] of [
        ["OUTGOING", settledBill.id, "vendorBillId"],
        ["INCOMING", settledInvoice.id, "salesInvoiceId"],
      ] as const) {
        const paymentIds: string[] = [];
        for (let index = 0; index < 3; index++) {
          const payment = await tx.payment.create({
            data: {
              organizationId: org.id,
              partyId: party.id,
              projectId: project.id,
              code: `DOC-ROUND-${direction}-${index}`,
              direction,
              date: new Date("2026-03-02"),
              mode: "BANK",
              currency: "USD",
              exchangeRate: 2,
              amount: 0.01,
              baseAmount: 0.02,
              allocatedAmount: 0.01,
              unallocatedAmount: 0,
              createdById: user.id,
            },
          });
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              [field]: documentId,
              amount: 0.01,
              baseAmount: 0.02,
              documentBaseAmount: 0.02,
              fxDifference: 0,
              allocatedById: user.id,
            },
          });
          paymentIds.push(payment.id);
        }
        for (const paymentId of paymentIds)
          await syncPaymentJournals(tx, org.id, paymentId, user.id);
        const documentRounding = await postedLines(
          tx,
          org.id,
          "PAYMENT_DOCUMENT_ROUNDING",
          `${field === "vendorBillId" ? "VENDOR_BILL" : "SALES_INVOICE"}:${documentId}`,
        );
        const accountKey =
          direction === "OUTGOING" ? "ACCOUNTS_PAYABLE" : "ACCOUNTS_RECEIVABLE";
        assert.equal(
          documentRounding
            .find((line) => line.account.systemKey === accountKey)
            ?.debit.toFixed(2),
          direction === "INCOMING" ? "0.01" : "0.00",
        );
        assert.equal(
          documentRounding
            .find((line) => line.account.systemKey === accountKey)
            ?.credit.toFixed(2),
          direction === "OUTGOING" ? "0.01" : "0.00",
        );
      }
      await tx.payment.update({
        where: { id: foreignCurrencyPayment.id },
        data: { status: "VOID", updatedAt: new Date("2026-03-10") },
      });
      await syncPaymentJournals(tx, org.id, foreignCurrencyPayment.id, user.id);
      await syncPaymentJournals(tx, org.id, foreignCurrencyPayment.id, user.id);
      assert.equal(
        await tx.journalEntry.count({
          where: {
            organizationId: org.id,
            reversalOf: {
              source: {
                sourceType: "PAYMENT",
                sourceId: foreignCurrencyPayment.id,
              },
            },
          },
        }),
        1,
      );
      const paymentReversal = await tx.journalEntry.findFirstOrThrow({
        where: {
          organizationId: org.id,
          reversalOf: {
            source: {
              sourceType: "PAYMENT",
              sourceId: foreignCurrencyPayment.id,
            },
          },
        },
      });
      assert.equal(
        paymentReversal.date.toISOString().slice(0, 10),
        "2026-03-10",
      );
    });
  },
);
