"use server";
import type { z } from "zod";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { typedAction } from "@/core/typed-action";
import {
  domainAudit,
  lockDocument,
} from "@/modules/procurement/server/service";
import {
  invoiceFormInput,
  invoiceServiceValues,
  submitInvoiceInput,
} from "../schema";
import { saveInvoice } from "./service";

async function context(org: string, projectId: string | null) {
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  assertPermission(ctx, "sales.invoice.create");
  return ctx;
}
export async function saveInvoiceAction(
  org: string,
  input: z.input<typeof invoiceFormInput>,
) {
  return typedAction(invoiceFormInput, async (parsed) => {
    const input = invoiceServiceValues(parsed);
    const ctx = await context(org, input.projectId);
    let originalProjectId: string | null | undefined;
    if (input.id) {
      const old = await db.salesInvoice.findFirstOrThrow({
        where: { id: input.id, organizationId: ctx.org.id },
      });
      await context(org, old.projectId);
      originalProjectId = old.projectId;
    }
    const row = await db.$transaction(
      (tx) => saveInvoice(tx, ctx, input, originalProjectId),
      { timeout: 20000 },
    );
    return `/${org}/sales/invoices/${row.id}`;
  })(input);
}
export async function submitInvoiceAction(
  org: string,
  input: z.input<typeof submitInvoiceInput>,
) {
  return typedAction(submitInvoiceInput, async (input) => {
    const orgCtx = await requireOrgContext(org);
    const row = await db.salesInvoice.findFirstOrThrow({
      where: { id: input.id, organizationId: orgCtx.org.id },
    });
    const ctx = await context(org, row.projectId);
    await db.$transaction(
      async (tx) => {
        await lockDocument(tx, "INV", row.id);
        const invoice = await tx.salesInvoice.findFirstOrThrow({
          where: { id: row.id, organizationId: ctx.org.id },
        });
        if (invoice.projectId !== row.projectId)
          throw new Error("Invoice changed. Reload before submitting.");
        if (invoice.status !== "DRAFT")
          throw new Error("Only drafts may be submitted.");
        const { submitForApproval } = await import(
          "@/modules/approvals/server/service"
        );
        const approval = await submitForApproval(
          {
            orgSlug: org,
            documentType: "SALES_INVOICE",
            documentId: invoice.id,
            title: `${invoice.code} · Sales invoice`,
            projectId: invoice.projectId,
            amount: invoice.grandTotal.toString(),
          },
          tx,
          ctx,
        );
        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: { status: "PENDING_APPROVAL", approvalRequestId: approval.id },
        });
        await domainAudit(ctx, tx, "SalesInvoice", invoice.id, "SUBMIT");
      },
      { timeout: 20000 },
    );
  })(input);
}
