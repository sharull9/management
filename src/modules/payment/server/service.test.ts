import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";
import { paymentInput, requestInput } from "../schema";

// Installed Node types target v20; the local smoke runner uses Node 24.
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
  "Postgres settlement workflows roll back fixtures",
  { skip: process.env.PAYMENTS_DB_TEST !== "local-only" },
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    // Remove the Next.js import sentinel only for this isolated Node test process.
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);
        return specifier === "server-only"
          ? { ...resolved, url: resolved.url.replace("index.js", "empty.js") }
          : resolved;
      },
    });
    const { db } = await import("@/core/db");
    const { saveRequest } = await import("./request-service");
    const { recordPayment } = await import("./payment-service");
    const { allocatePayment } = await import("./allocation-service");
    const { voidPayment } = await import("./void-service");
    const { onApproved, onRejected, onCanceled } = await import("./approval");
    const { submitRequest } = await import("./submission");
    const { partyBalances } = await import("./balances");
    const { partyStatement } = await import("./statement");
    const rollback = new Error("ROLLBACK_SETTLEMENT_TEST");
    try {
      await db.$transaction(
        async (tx) => {
          const token = `paytest-${crypto.randomUUID()}`;
          const tenant = await tx.tenant.create({
            data: { name: token, slug: token },
          });
          const org = await tx.organization.create({
            data: { name: token, slug: token, tenantId: tenant.id },
          });
          const user = await tx.user.create({
            data: { name: token, email: `${token}@example.test` },
          });
          const party = await tx.party.create({
            data: {
              tenantId: tenant.id,
              code: "BOTH",
              legalName: token,
              displayName: token,
              isVendor: true,
              isCustomer: true,
            },
          });
          const other = await tx.party.create({
            data: {
              tenantId: tenant.id,
              code: "OTHER",
              legalName: "Other",
              displayName: "Other",
              isVendor: true,
            },
          });
          const project = await tx.project.create({
            data: {
              organizationId: org.id,
              code: "P",
              name: "Project",
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
          const bill = await tx.vendorBill.create({
            data: {
              organizationId: org.id,
              projectId: project.id,
              partyId: party.id,
              code: "B1",
              date: new Date("2026-01-01"),
              vendorInvoiceNo: "V1",
              vendorInvoiceDate: new Date("2026-01-01"),
              currency: "INR",
              subtotal: "100",
              taxTotal: "0",
              grandTotal: "100",
              payableTotal: "100",
              createdById: user.id,
              status: "APPROVED",
            },
          });
          const invoice = await tx.salesInvoice.create({
            data: {
              organizationId: org.id,
              partyId: party.id,
              code: "I1",
              date: new Date("2026-01-01"),
              currency: "INR",
              subtotal: "100",
              taxTotal: "0",
              grandTotal: "100",
              payableTotal: "100",
              createdById: user.id,
              status: "APPROVED",
            },
          });
          const payment = (extra: Record<string, unknown> = {}) =>
            paymentInput.parse({
              partyId: party.id,
              projectId: null,
              date: "2026-01-02",
              mode: "BANK",
              direction: "OUTGOING",
              amount: "40",
              reference: "",
              notes: "",
              paymentRequestId: null,
              ...extra,
            });
          await assert.rejects(
            recordPayment(tx, ctx, payment({ mode: "CASH" })),
            /requires an approved/,
          );
          const advance = await recordPayment(tx, ctx, payment());
          assert.equal(advance.unallocatedAmount.toFixed(2), "40.00");
          await assert.rejects(
            allocatePayment(tx, ctx, advance.id, [
              { documentId: bill.id, amount: "41" },
            ]),
            /unallocated/,
          );
          await allocatePayment(tx, ctx, advance.id, [
            { documentId: bill.id, amount: "40" },
          ]);
          await assert.rejects(
            allocatePayment(tx, ctx, advance.id, [
              { documentId: bill.id, amount: "1" },
            ]),
            /unallocated/,
          );
          let settled = await tx.vendorBill.findUniqueOrThrow({
            where: { id: bill.id },
          });
          assert.equal(settled.paidTotal.toFixed(2), "40.00");
          assert.equal(settled.status, "PARTIALLY_PAID");
          const request = await saveRequest(
            tx,
            ctx,
            requestInput.parse({
              id: null,
              partyId: party.id,
              projectId: null,
              date: "2026-01-02",
              mode: "CASH",
              purpose: "BILL_SETTLEMENT",
              amount: "60",
              reason: "Settle bill",
              allocations: [{ documentId: bill.id, amount: "60" }],
            }),
          );
          await submitRequest(tx, ctx, request.id);
          const approval = await tx.approvalRequest.findFirstOrThrow({
            where: { organizationId: org.id, documentId: request.id },
          });
          assert.equal(approval.amount?.toFixed(2), "60.00");
          await onRejected(approval, tx, user.id);
          assert.equal(
            (
              await tx.paymentRequest.findUniqueOrThrow({
                where: { id: request.id },
              })
            ).status,
            "DRAFT",
          );
          await tx.paymentRequest.update({
            where: { id: request.id },
            data: { status: "PENDING_APPROVAL" },
          });
          await onCanceled(approval, tx, user.id);
          await tx.paymentRequest.update({
            where: { id: request.id },
            data: { status: "PENDING_APPROVAL" },
          });
          await onApproved(approval, tx, user.id);
          await assert.rejects(
            recordPayment(
              tx,
              ctx,
              payment({
                mode: "CASH",
                paymentRequestId: request.id,
                partyId: other.id,
              }),
            ),
            /must match request/,
          );
          const first = await recordPayment(
            tx,
            ctx,
            payment({
              mode: "CASH",
              paymentRequestId: request.id,
              amount: "20",
            }),
          );
          assert.equal(
            (
              await tx.paymentRequest.findUniqueOrThrow({
                where: { id: request.id },
              })
            ).status,
            "APPROVED",
          );
          await assert.rejects(
            recordPayment(
              tx,
              ctx,
              payment({
                mode: "CASH",
                paymentRequestId: request.id,
                amount: "41",
              }),
            ),
            /unallocated/,
          );
          const second = await recordPayment(
            tx,
            ctx,
            payment({
              mode: "CASH",
              paymentRequestId: request.id,
              amount: "40",
            }),
          );
          settled = await tx.vendorBill.findUniqueOrThrow({
            where: { id: bill.id },
          });
          assert.equal(settled.paidTotal.toFixed(2), "100.00");
          assert.equal(settled.status, "PAID");
          assert.equal(
            (
              await tx.paymentRequest.findUniqueOrThrow({
                where: { id: request.id },
              })
            ).status,
            "PAID",
          );
          await voidPayment(tx, ctx, first.id, "Duplicate entry");
          assert.equal(
            (
              await tx.vendorBill.findUniqueOrThrow({ where: { id: bill.id } })
            ).paidTotal.toFixed(2),
            "80.00",
          );
          assert.equal(
            (
              await tx.paymentRequest.findUniqueOrThrow({
                where: { id: request.id },
              })
            ).status,
            "APPROVED",
          );
          await recordPayment(
            tx,
            ctx,
            payment({
              mode: "CASH",
              paymentRequestId: request.id,
              amount: "20",
            }),
          );
          assert.equal(
            (await tx.vendorBill.findUniqueOrThrow({ where: { id: bill.id } }))
              .status,
            "PAID",
          );
          await voidPayment(tx, ctx, second.id, "Correction");
          const incoming = await recordPayment(
            tx,
            ctx,
            payment({ direction: "INCOMING", amount: "120" }),
          );
          await allocatePayment(tx, ctx, incoming.id, [
            { documentId: invoice.id, amount: "100" },
          ]);
          assert.equal(
            (
              await tx.salesInvoice.findUniqueOrThrow({
                where: { id: invoice.id },
              })
            ).status,
            "PAID",
          );
          assert.equal(
            (
              await tx.payment.findUniqueOrThrow({ where: { id: incoming.id } })
            ).unallocatedAmount.toFixed(2),
            "20.00",
          );
          await voidPayment(tx, ctx, incoming.id, "Returned receipt");
          assert.equal(
            (
              await tx.salesInvoice.findUniqueOrThrow({
                where: { id: invoice.id },
              })
            ).receivedTotal.toFixed(2),
            "0.00",
          );
          assert.equal(
            (
              await tx.salesInvoice.findUniqueOrThrow({
                where: { id: invoice.id },
              })
            ).status,
            "APPROVED",
          );
          const secondBill = await tx.vendorBill.create({
            data: {
              ...bill,
              id: undefined,
              code: "B2",
              vendorInvoiceNo: "V2",
              payableTotal: "50",
              grandTotal: "50",
              subtotal: "50",
              paidTotal: "0",
            },
          });
          const spread = await recordPayment(
            tx,
            ctx,
            payment({ amount: "60" }),
          );
          await allocatePayment(tx, ctx, spread.id, [
            { documentId: bill.id, amount: "40" },
            { documentId: secondBill.id, amount: "20" },
          ]);
          assert.equal(
            (await tx.vendorBill.findUniqueOrThrow({ where: { id: bill.id } }))
              .status,
            "PAID",
          );
          assert.equal(
            (
              await tx.vendorBill.findUniqueOrThrow({
                where: { id: secondBill.id },
              })
            ).paidTotal.toFixed(2),
            "20.00",
          );
          const extra = await recordPayment(
            tx,
            ctx,
            payment({ amount: "100" }),
          );
          await assert.rejects(
            recordPayment(
              tx,
              { ...ctx, isAdmin: false, permissions: new Set() },
              payment(),
            ),
            /permission/,
          );
          const foreignBill = await tx.vendorBill.create({
            data: {
              ...secondBill,
              id: undefined,
              code: "FOREIGN",
              partyId: other.id,
            },
          });
          await assert.rejects(
            allocatePayment(tx, ctx, extra.id, [
              { documentId: foreignBill.id, amount: "1" },
            ]),
          );
          const euroBill = await tx.vendorBill.create({
            data: {
              ...secondBill,
              id: undefined,
              code: "EURO",
              currency: "EUR",
            },
          });
          await assert.rejects(
            allocatePayment(tx, ctx, extra.id, [
              { documentId: euroBill.id, amount: "1" },
            ]),
          );
          await assert.rejects(
            allocatePayment(tx, ctx, incoming.id, [
              { documentId: invoice.id, amount: "1" },
            ]),
          );
          await assert.rejects(voidPayment(tx, ctx, incoming.id, "Again"));
          await assert.rejects(
            allocatePayment(tx, ctx, extra.id, [
              { documentId: secondBill.id, amount: "31" },
            ]),
            /outstanding/,
          );
          await assert.rejects(
            allocatePayment(tx, ctx, extra.id, [
              { documentId: secondBill.id, amount: "1" },
              { documentId: secondBill.id, amount: "1" },
            ]),
            /each document once/,
          );
          const data = {
            ctx,
            allowOrganization: true,
            canViewOrg: true,
            projectId: undefined,
            projects: [project],
            parties: [party],
            requests: [],
            payments: await tx.payment.findMany({
              where: { organizationId: org.id },
              include: {
                party: true,
                allocations: {
                  include: { vendorBill: true, salesInvoice: true },
                },
              },
            }),
            bills: await tx.vendorBill.findMany({
              where: { organizationId: org.id },
            }),
            invoices: await tx.salesInvoice.findMany({
              where: { organizationId: org.id },
            }),
          };
          const balance = partyBalances(data)[0];
          const statement = partyStatement(data, party.id, "INR");
          assert.equal(statement.at(-1)?.balance, balance.net.toFixed(2));
          const projectData = { ...data, projectId: project.id, invoices: [] };
          const projectBalance = partyBalances(projectData)[0];
          assert.equal(
            partyStatement(projectData, party.id, "INR").at(-1)?.balance,
            projectBalance.net.toFixed(2),
          );
          assert.equal(projectBalance.outgoingAdvance.toFixed(2), "0.00");
          assert.ok(
            await tx.auditLog.count({
              where: { organizationId: org.id, action: "VOID" },
            }),
          );
          throw rollback;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      hooks.deregister();
      await db.$disconnect();
    }
  },
);
