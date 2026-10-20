import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

// Installed Node types target v20; the opt-in local runner uses Node 24.
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
  "payment read loaders paginate, filter, search and hide inaccessible linked data",
  { skip: process.env.PAYMENTS_DB_TEST !== "local-only" },
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    assert.match(
      url.pathname,
      /_test$/,
      "Use a disposable database ending in _test.",
    );

    const contextUrl = new URL("./read-query-test-context.ts", import.meta.url)
      .href;
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
    const token = `payment-read-${crypto.randomUUID()}`;
    const ids: {
      tenantId?: string;
      organizationId?: string;
      userId?: string;
      partyId?: string;
      projectIds?: string[];
      invoiceId?: string;
      billId?: string;
      requestId?: string;
    } = {};
    try {
      const { db } = await import("@/core/db");
      const { setPaymentReadTestContext } = await import(
        "./read-query-test-context"
      );
      const { paymentListData, requestListData } = await import(
        "./list-queries"
      );
      const { paymentFormData, requestFormData } = await import(
        "./form-queries"
      );
      const { findOpenDocuments, findParties, findProjects } = await import(
        "./picker-actions"
      );
      const currency = await db.currency.findFirstOrThrow({
        select: { code: true },
      });
      const tenant = await db.tenant.create({
        data: { name: token, slug: token },
      });
      ids.tenantId = tenant.id;
      const organization = await db.organization.create({
        data: {
          name: token,
          slug: token,
          tenantId: tenant.id,
          baseCurrency: currency.code,
        },
      });
      ids.organizationId = organization.id;
      const user = await db.user.create({
        data: { name: token, email: `${token}@example.test` },
      });
      ids.userId = user.id;
      const party = await db.party.create({
        data: {
          tenantId: tenant.id,
          code: `${token}-party`,
          legalName: token,
          displayName: `${token} vendor`,
          isVendor: true,
        },
      });
      ids.partyId = party.id;
      const [visibleProject, hiddenProject] = await Promise.all([
        db.project.create({
          data: {
            organizationId: organization.id,
            code: `${token}-visible`,
            name: `${token} visible project`,
            currency: currency.code,
            managerUserId: user.id,
          },
        }),
        db.project.create({
          data: {
            organizationId: organization.id,
            code: `${token}-hidden`,
            name: `${token} hidden project label`,
            currency: currency.code,
          },
        }),
      ]);
      ids.projectIds = [visibleProject.id, hiddenProject.id];
      const context = {
        user,
        tenant,
        org: organization,
        member: null,
        tenantRole: null,
        isAdmin: false,
        permissions: new Set<string>(["payment.request.create"]),
      };
      setPaymentReadTestContext(context);

      await db.project.createMany({
        data: Array.from({ length: 51 }, (_, index) => ({
          organizationId: organization.id,
          code: `${token}-picker-${String(index).padStart(3, "0")}`,
          name: `${token} picker project ${String(index).padStart(3, "0")}`,
          currency: currency.code,
          managerUserId: user.id,
        })),
      });
      await db.party.createMany({
        data: Array.from({ length: 51 }, (_, index) => ({
          tenantId: tenant.id,
          code: `${token}-picker-${String(index).padStart(3, "0")}`,
          legalName: `${token} picker vendor ${index}`,
          displayName: `${token} picker vendor ${String(index).padStart(3, "0")}`,
          isVendor: true,
        })),
      });
      const lateParty = await db.party.create({
        data: {
          tenantId: tenant.id,
          code: `${token}-late-party`,
          legalName: `${token} late vendor`,
          displayName: `${token} zzz vendor`,
          isVendor: true,
        },
      });

      await db.payment.createMany({
        data: Array.from({ length: 52 }, (_, index) => ({
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `PAY-${String(index + 1).padStart(3, "0")}`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          amount: "1.00",
          baseAmount: "1.00",
          unallocatedAmount: "1.00",
          mode: "BANK" as const,
          direction:
            index % 2 === 0 ? ("INCOMING" as const) : ("OUTGOING" as const),
          createdById: user.id,
        })),
      });
      await db.paymentRequest.createMany({
        data: Array.from({ length: 52 }, (_, index) => ({
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `REQ-${String(index + 1).padStart(3, "0")}`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          amount: "1.00",
          baseAmount: "1.00",
          mode: "BANK" as const,
          purpose: "ADVANCE" as const,
          requestedById: user.id,
          reason: token,
        })),
      });

      await db.paymentRequest.createMany({
        data: Array.from({ length: 51 }, (_, index) => ({
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `FORM-APPROVED-${String(index).padStart(3, "0")}`,
          date: new Date(Date.UTC(2026, 1, index + 1)),
          currency: currency.code,
          amount: "1.00",
          mode: "BANK" as const,
          purpose: "ADVANCE" as const,
          requestedById: user.id,
          reason: token,
          status: "APPROVED" as const,
        })),
      });
      const oldApprovedRequest = await db.paymentRequest.create({
        data: {
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: lateParty.id,
          code: `${token}-approved-beyond-50`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          amount: "1.00",
          mode: "BANK",
          purpose: "ADVANCE",
          requestedById: user.id,
          reason: token,
          status: "APPROVED",
        },
      });
      const approvedForm = await paymentFormData(
        organization.slug,
        oldApprovedRequest.id,
      );
      assert.ok(
        approvedForm.requests.some(
          (request) => request.id === oldApprovedRequest.id,
        ),
      );
      assert.ok(
        approvedForm.projects.some(
          (project) => project.id === visibleProject.id,
        ),
      );
      assert.ok(
        approvedForm.parties.some((candidate) => candidate.id === lateParty.id),
      );
      const defaultPaymentForm = await paymentFormData(organization.slug);
      assert.ok(
        !defaultPaymentForm.parties.some(
          (candidate) => candidate.id === lateParty.id,
        ),
      );
      assert.equal(
        (
          await findProjects(
            organization.slug,
            "payment.request.create",
            `${token} picker project 050`,
          )
        ).length,
        1,
      );
      assert.equal(
        (
          await findParties(
            organization.slug,
            "payment.request.create",
            "OUTGOING",
            `${token} picker vendor 050`,
          )
        ).length,
        1,
      );

      const invoice = await db.salesInvoice.create({
        data: {
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `${token}-invoice`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          subtotal: "10.00",
          taxTotal: "0.00",
          grandTotal: "10.00",
          payableTotal: "10.00",
          createdById: user.id,
          status: "APPROVED",
        },
      });
      ids.invoiceId = invoice.id;
      const linkedPayment = await db.payment.create({
        data: {
          organizationId: organization.id,
          projectId: hiddenProject.id,
          partyId: party.id,
          code: `${token}-linked-payment`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          amount: "1.00",
          baseAmount: "1.00",
          allocatedAmount: "1.00",
          unallocatedAmount: "0.00",
          mode: "BANK",
          direction: "OUTGOING",
          createdById: user.id,
        },
      });
      await db.paymentAllocation.create({
        data: {
          paymentId: linkedPayment.id,
          salesInvoiceId: invoice.id,
          amount: "1.00",
          allocatedById: user.id,
        },
      });

      const page = await paymentListData(organization.slug, {
        search: "PAY-",
        sort: "code",
        sortDirection: "asc",
        page: "2",
      });
      assert.equal(page.page.total, 52);
      assert.equal(page.rows[0]?.code, "PAY-026");
      const incoming = await paymentListData(organization.slug, {
        search: "PAY-",
        direction: "INCOMING",
      });
      assert.equal(incoming.page.total, 26);
      const linked = await paymentListData(organization.slug, {
        search: `${token}-linked-payment`,
      });
      assert.equal(linked.page.total, 1);
      assert.equal(linked.rows[0]?.projectLabel, "Project not available");
      assert.equal(linked.rows[0]?.project, null);

      const requestPage = await requestListData(organization.slug, {
        search: "REQ-",
        sort: "code",
        sortDirection: "asc",
        page: "2",
      });
      assert.equal(requestPage.page.total, 52);
      assert.equal(requestPage.rows[0]?.code, "REQ-026");

      const beyond50Bills = await db.vendorBill.createMany({
        data: Array.from({ length: 51 }, (_, index) => ({
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `FORM-BILL-${String(index).padStart(3, "0")}`,
          date: new Date(Date.UTC(2026, 1, index + 1)),
          vendorInvoiceNo: `FORM-INVOICE-${index}`,
          vendorInvoiceDate: new Date(Date.UTC(2026, 1, index + 1)),
          currency: currency.code,
          subtotal: "10.00",
          taxTotal: "0.00",
          grandTotal: "10.00",
          payableTotal: "10.00",
          createdById: user.id,
          status: "APPROVED" as const,
        })),
      });
      assert.equal(beyond50Bills.count, 51);
      const selectedBill = await db.vendorBill.findUniqueOrThrow({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: "FORM-BILL-050",
          },
        },
      });
      const draftBeyond50 = await db.paymentRequest.create({
        data: {
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `${token}-draft-with-bill-beyond-50`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          amount: "10.00",
          mode: "BANK",
          purpose: "BILL_SETTLEMENT",
          requestedById: user.id,
          reason: token,
        },
      });
      await db.paymentRequestBill.create({
        data: {
          paymentRequestId: draftBeyond50.id,
          billId: selectedBill.id,
          amount: "10.00",
        },
      });
      const draftForm = await requestFormData(
        organization.slug,
        draftBeyond50.id,
      );
      assert.ok(
        draftForm.data.bills.some((bill) => bill.id === selectedBill.id),
      );
      assert.equal(
        (
          await findOpenDocuments(
            organization.slug,
            "payment.request.create",
            "OUTGOING",
            party.id,
            visibleProject.id,
            currency.code,
            "FORM-BILL-050",
          )
        ).length,
        1,
      );

      const hiddenBill = await db.vendorBill.create({
        data: {
          organizationId: organization.id,
          projectId: hiddenProject.id,
          partyId: party.id,
          code: `${token}-hidden-bill-code`,
          date: new Date("2026-01-01"),
          vendorInvoiceNo: `${token}-invoice-no`,
          vendorInvoiceDate: new Date("2026-01-01"),
          currency: currency.code,
          subtotal: "10.00",
          taxTotal: "0.00",
          grandTotal: "10.00",
          payableTotal: "10.00",
          createdById: user.id,
          status: "APPROVED",
        },
      });
      ids.billId = hiddenBill.id;
      const request = await db.paymentRequest.create({
        data: {
          organizationId: organization.id,
          projectId: visibleProject.id,
          partyId: party.id,
          code: `${token}-request-with-hidden-bill`,
          date: new Date("2026-01-01"),
          currency: currency.code,
          amount: "10.00",
          mode: "BANK",
          purpose: "BILL_SETTLEMENT",
          requestedById: user.id,
          reason: token,
        },
      });
      ids.requestId = request.id;
      await db.paymentRequestBill.create({
        data: {
          paymentRequestId: request.id,
          billId: hiddenBill.id,
          amount: "10.00",
        },
      });
      const hiddenSearch = await requestListData(organization.slug, {
        search: `${token}-hidden-bill-code`,
      });
      assert.equal(hiddenSearch.page.total, 0);
    } finally {
      const { db } = await import("@/core/db");
      if (ids.organizationId) {
        await db.paymentAllocation.deleteMany({
          where: { payment: { organizationId: ids.organizationId } },
        });
        await db.paymentRequestBill.deleteMany({
          where: { paymentRequest: { organizationId: ids.organizationId } },
        });
        await db.payment.deleteMany({
          where: { organizationId: ids.organizationId },
        });
        await db.paymentRequest.deleteMany({
          where: { organizationId: ids.organizationId },
        });
        await db.salesInvoice.deleteMany({
          where: { organizationId: ids.organizationId },
        });
        await db.vendorBill.deleteMany({
          where: { organizationId: ids.organizationId },
        });
        await db.project.deleteMany({
          where: { organizationId: ids.organizationId },
        });
        await db.organization.delete({ where: { id: ids.organizationId } });
      }
      if (ids.tenantId)
        await db.party.deleteMany({
          where: { tenantId: ids.tenantId, code: { startsWith: token } },
        });
      if (ids.userId) await db.user.delete({ where: { id: ids.userId } });
      if (ids.tenantId) await db.tenant.delete({ where: { id: ids.tenantId } });
      hooks.deregister();
    }
  },
);
