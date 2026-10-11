import "dotenv/config";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import type { Prisma } from "@/generated/prisma/client";
import { createFixture } from "./phase3b-smoke-fixture";
import { linksSmoke } from "./phase3b-smoke-links";
import { stockSmoke } from "./phase3b-smoke-stock";

// Node runs real services with a signed HTTP session, outside Next's request scope.
const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: object,
      next: (specifier: string, context: object) => { url: string },
    ): { url: string };
  }): unknown;
};
const local = new URL(process.env.DATABASE_URL ?? "");
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const password = process.env.PHASE3B_SMOKE_PASSWORD;
assert.equal(process.env.PHASE3B_SMOKE_CONFIRM, "local-only");
assert.ok(["localhost", "127.0.0.1"].includes(local.hostname));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
assert.ok(
  password,
  "Set PHASE3B_SMOKE_PASSWORD for the isolated local account.",
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/headers")
      return next(
        new URL("./phase3b-smoke-headers.ts", import.meta.url).href,
        context,
      );
    const result = next(specifier, context);
    return specifier === "server-only"
      ? { ...result, url: result.url.replace("index.js", "empty.js") }
      : result;
  },
});

async function main() {
  const { db } = await import("@/core/db");
  const { actOnApproval, submitForApproval } = await import(
    "@/modules/approvals/server/service"
  );
  const { financeDocumentTitles } = await import(
    "@/modules/approvals/server/document-link"
  );
  const { saveBill } = await import("@/modules/vendor-bill/server/service");
  const { billInput } = await import("@/modules/vendor-bill/schema");
  const { paymentInput, requestInput } = await import(
    "@/modules/payment/schema"
  );
  const { recordPayment } = await import(
    "@/modules/payment/server/payment-service"
  );
  const { saveRequest } = await import(
    "@/modules/payment/server/request-service"
  );
  const { submitRequest } = await import("@/modules/payment/server/submission");
  const { allocatePayment } = await import(
    "@/modules/payment/server/allocation-service"
  );
  const { voidPayment } = await import("@/modules/payment/server/void-service");
  const { financeData } = await import("@/modules/payment/server/queries");
  const { partyBalances } = await import("@/modules/payment/server/balances");
  const { partyStatement } = await import("@/modules/payment/server/statement");
  const { saveInvoice } = await import(
    "@/modules/sales-invoice/server/service"
  );
  const { invoiceInput } = await import("@/modules/sales-invoice/schema");
  const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
    db.$transaction(fn, { timeout: 30000 });
  try {
    const fixture = await createFixture(db, origin, password as string);
    const {
      token,
      user,
      org,
      ctx,
      vendor,
      customer,
      projects,
      p1,
      p2,
      uom,
      state,
      tax,
      item,
      selection,
    } = fixture;
    async function approve(requestId: string) {
      const step = await db.approvalRequestStep.findFirstOrThrow({
        where: { requestId, status: "PENDING" },
      });
      await actOnApproval(step.id, "APPROVE", "Local integration smoke");
      assert.equal(
        (
          await db.approvalRequest.findUniqueOrThrow({
            where: { id: requestId },
          })
        ).status,
        "APPROVED",
      );
    }
    async function submitFinance(
      type: "VENDOR_BILL" | "SALES_INVOICE",
      id: string,
      projectId: string,
      code: string,
      total: string,
    ) {
      return transaction(async (tx) => {
        const request = await submitForApproval(
          {
            orgSlug: org.slug,
            documentType: type,
            documentId: id,
            projectId,
            title: `${code} ${financeDocumentTitles[type]}`,
            amount: total,
          },
          tx,
          ctx,
        );
        const data = {
          status: "PENDING_APPROVAL" as const,
          approvalRequestId: request.id,
        };
        if (type === "VENDOR_BILL")
          await tx.vendorBill.update({ where: { id }, data });
        else await tx.salesInvoice.update({ where: { id }, data });
        return request;
      });
    }
    const cost = async (projectId: string) =>
      (
        await db.costEntry.aggregate({
          where: { projectId },
          _sum: { amount: true },
        })
      )._sum.amount?.toFixed(2) ?? "0.00";
    const orders = await stockSmoke(db, fixture, approve);
    const variant = await db.itemVariant.findFirstOrThrow({
      where: { itemId: item.id },
    });
    const bill = await transaction((tx) =>
      saveBill(
        tx,
        ctx,
        billInput.parse({
          id: null,
          projectId: p1.id,
          partyId: vendor.id,
          purchaseOrderId: orders[0].po.id,
          date: "2026-09-05",
          vendorInvoiceNo: token,
          vendorInvoiceDate: "2026-09-05",
          dueDate: "2026-09-06",
          lines: [
            {
              poLineId: orders[0].poLine.id,
              itemVariantId: variant.id,
              description: "Received material",
              qty: "10",
              uomId: uom.id,
              rate: "90",
              discountPercent: "0",
              taxGroupId: tax.id,
            },
          ],
        }),
      ),
    );
    assert.equal(bill.grandTotal.toFixed(2), "1062.00");
    assert.equal(bill.withholdingTotal.toFixed(2), "9.00");
    assert.equal(bill.payableTotal.toFixed(2), "1053.00");
    await approve(
      (
        await submitFinance(
          "VENDOR_BILL",
          bill.id,
          p1.id,
          bill.code,
          bill.grandTotal.toString(),
        )
      ).id,
    );
    assert.equal(
      (
        await db.costEntry.findFirstOrThrow({
          where: { sourceType: "BILL_VARIANCE", sourceId: bill.id },
        })
      ).amount.toFixed(2),
      "-100.00",
    );
    const payment = (
      amount: string,
      mode = "BANK",
      request: string | null = null,
      partyId = vendor.id,
      direction = "OUTGOING",
    ) =>
      paymentInput.parse({
        projectId: p1.id,
        partyId,
        date: "2026-09-07",
        mode,
        amount,
        paymentRequestId: request,
        reference: "Local smoke",
        notes: "",
        direction,
      });
    await assert.rejects(
      transaction((tx) => recordPayment(tx, ctx, payment("400", "CASH"))),
      /requires an approved payment request/,
    );
    const request = await transaction((tx) =>
      saveRequest(
        tx,
        ctx,
        requestInput.parse({
          id: null,
          projectId: p1.id,
          partyId: vendor.id,
          date: "2026-09-07",
          mode: "CASH",
          amount: "400",
          purpose: "BILL_SETTLEMENT",
          reason: "Partial bill payment",
          allocations: [{ documentId: bill.id, amount: "400" }],
        }),
      ),
    );
    await transaction((tx) => submitRequest(tx, ctx, request.id));
    await approve(
      (await db.paymentRequest.findUniqueOrThrow({ where: { id: request.id } }))
        .approvalRequestId as string,
    );
    await transaction((tx) =>
      recordPayment(tx, ctx, payment("400", "CASH", request.id)),
    );
    assert.equal(
      (await db.vendorBill.findUniqueOrThrow({ where: { id: bill.id } }))
        .status,
      "PARTIALLY_PAID",
    );
    const advance = await transaction((tx) =>
      recordPayment(tx, ctx, payment("653")),
    );
    await transaction((tx) =>
      allocatePayment(tx, ctx, advance.id, [
        { documentId: bill.id, amount: "653" },
      ]),
    );
    assert.equal(
      (await db.vendorBill.findUniqueOrThrow({ where: { id: bill.id } }))
        .status,
      "PAID",
    );
    await transaction((tx) =>
      voidPayment(tx, ctx, advance.id, "Smoke void advance"),
    );
    const reverted = await db.vendorBill.findUniqueOrThrow({
      where: { id: bill.id },
    });
    assert.equal(reverted.status, "PARTIALLY_PAID");
    assert.equal(reverted.paidTotal.toFixed(2), "400.00");
    console.log(
      "Bill: base 900.00 + GST 162.00 - TDS 9.00 = payable 1053.00; variance -100.00. Paid 400.00 -> 1053.00 -> void -> 400.00, outstanding 653.00.",
    );
    const invoice = await transaction((tx) =>
      saveInvoice(
        tx,
        ctx,
        invoiceInput.parse({
          id: null,
          projectId: p2.id,
          partyId: customer.id,
          date: "2026-09-08",
          dueDate: "2026-09-09",
          stateId: state.id,
          notes: "Smoke sale",
          lines: [
            {
              ...selection,
              description: "Material sale",
              qty: "2",
              rate: "150",
              discountPercent: "0",
              taxGroupId: tax.id,
              fromProjectStock: true,
            },
          ],
        }),
      ),
    );
    assert.equal(invoice.payableTotal.toFixed(2), "351.00");
    await approve(
      (
        await submitFinance(
          "SALES_INVOICE",
          invoice.id,
          p2.id,
          invoice.code,
          invoice.grandTotal.toString(),
        )
      ).id,
    );
    const sale = await db.stockMovement.findFirstOrThrow({
      where: { projectId: p2.id, type: "SALE_OUT" },
    });
    assert.equal(sale.qty.toString(), "-2");
    assert.equal(sale.totalCost.toString(), "-200");
    const incoming = await transaction((tx) =>
      recordPayment(
        tx,
        ctx,
        paymentInput.parse({
          ...payment("351", "BANK", null, customer.id, "INCOMING"),
          projectId: p2.id,
          date: "2026-09-09",
        }),
      ),
    );
    await transaction((tx) =>
      allocatePayment(tx, ctx, incoming.id, [
        { documentId: invoice.id, amount: "351" },
      ]),
    );
    assert.equal(
      (await db.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } }))
        .status,
      "PAID",
    );
    assert.equal(await cost(p1.id), "600.00");
    assert.equal(await cost(p2.id), "200.00");
    const stocks = await Promise.all(
      projects.map((p) =>
        db.stockMovement.aggregate({
          where: { projectId: p.id },
          _sum: { qty: true, totalCost: true },
        }),
      ),
    );
    assert.deepEqual(
      stocks.map((s) => [s._sum.qty?.toString(), s._sum.totalCost?.toString()]),
      [
        ["5", "500"],
        ["9", "900"],
      ],
    );
    const data = await financeData(org.slug);
    const balances = partyBalances(data);
    const vendorBalance = balances.find((b) => b.party.id === vendor.id);
    assert.equal(vendorBalance?.payable.toFixed(2), "653.00");
    assert.equal(vendorBalance?.net.toFixed(2), "-653.00");
    assert.equal(
      Object.values(vendorBalance?.payableAging ?? {}).reduce(
        (sum, v) => sum + Number(v),
        0,
      ),
      653,
    );
    assert.equal(
      balances.find((b) => b.party.id === customer.id)?.net.toFixed(2),
      "0.00",
    );
    assert.equal(
      partyStatement(data, vendor.id, "INR").at(-1)?.balance,
      "-653.00",
    );
    console.log(
      "Sale: base 300.00 + GST 54.00 - TDS 3.00 = 351.00; SALE_OUT -2 / -200.00; receipt 351.00 -> PAID. Final P1 stock 5 / 500.00, cost 600.00; P2 stock 9 / 900.00, cost 200.00. Vendor balance/statement -653.00; customer 0.00.",
    );
    // The tightened CHECK must still reject unrelated negative costs.
    for (const [costType, sourceType] of [
      ["OTHER", "TRANSFER"],
      ["MATERIAL", "EXPENSE"],
      ["MATERIAL", "GRN"],
    ] as const)
      await assert.rejects(
        transaction((tx) =>
          tx.costEntry.create({
            data: {
              organizationId: org.id,
              projectId: p1.id,
              date: new Date("2026-09-10"),
              costType,
              sourceType,
              sourceId: crypto.randomUUID(),
              description: "Constraint smoke",
              amount: "-1",
              createdById: user.id,
            },
          }),
        ),
        /constraint|cost_entry_amount/i,
      );
    await linksSmoke(db, fixture, origin);
    console.log(
      JSON.stringify({
        org: org.slug,
        project1: p1.id,
        project2: p2.id,
        vendor: vendor.id,
        customer: customer.id,
        bill: bill.id,
        invoice: invoice.id,
        email: user.email,
      }),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
