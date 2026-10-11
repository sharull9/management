"use server";
import type { z } from "zod";
import type { ActionState } from "@/core/action-result";
import { runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { storage } from "@/core/storage";
import { typedAction } from "@/core/typed-action";
import {
  domainAudit,
  lockDocument,
} from "@/modules/procurement/server/service";
import {
  billAttachmentInput,
  billDocumentInput,
  billUploadInput,
} from "../schema";
import { assertBillReceipts, saveBill } from "./service";
import { createBillAttachment } from "./upload";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export async function saveBillAction(org: string, data: FormData) {
  return typedAction(billUploadInput, async ({ attachment, ...input }) => {
    const ctx = await requireProjectContext(org, input.projectId);
    assertPermission(ctx, "bill.create");
    const key = attachment
      ? await storage.put(new Uint8Array(await attachment.arrayBuffer()))
      : null;
    let billId: string;
    try {
      billId = await db.$transaction(
        async (tx) => {
          const bill = await saveBill(tx, ctx, input);
          if (attachment && key)
            await createBillAttachment(tx, ctx, bill.id, attachment, key);
          return bill.id;
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (key) await storage.delete(key).catch(() => {});
      throw error;
    }
    return `/${org}/procurement/bills/${billId}`;
  })(data);
}
export async function submitBillAction(
  org: string,
  input: z.input<typeof billDocumentInput>,
) {
  return typedAction(billDocumentInput, async ({ id: documentId }) => {
    const row = await db.vendorBill.findFirstOrThrow({
      where: { id: documentId, organization: { slug: org } },
    });
    const ctx = await requireProjectContext(org, row.projectId);
    assertPermission(ctx, "bill.create");
    await db.$transaction(
      async (tx) => {
        await lockDocument(tx, "BILL", documentId);
        const bill = await tx.vendorBill.findFirstOrThrow({
          where: { id: documentId, organizationId: ctx.org.id },
          include: { lines: true },
        });
        if (bill.status !== "DRAFT")
          throw new Error("Only drafts may be submitted.");
        if (!bill.lines.length) throw new Error("Add at least one bill line.");
        await assertBillReceipts(
          tx,
          ctx.org.id,
          bill.id,
          bill.purchaseOrderId,
          bill.lines,
        );
        const { submitForApproval } = await import(
          "@/modules/approvals/server/service"
        );
        const approval = await submitForApproval(
          {
            orgSlug: org,
            documentType: "VENDOR_BILL",
            documentId: bill.id,
            title: `${bill.code} Vendor bill`,
            projectId: bill.projectId,
            amount: bill.grandTotal.toString(),
          },
          tx,
          ctx,
        );
        await tx.vendorBill.update({
          where: { id: bill.id },
          data: { status: "PENDING_APPROVAL", approvalRequestId: approval.id },
        });
        await domainAudit(ctx, tx, "VendorBill", bill.id, "SUBMIT");
      },
      { timeout: 20000 },
    );
  })(input);
}
export async function attachBillAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const billId = id.parse(value(data, "id"));
    const bill = await db.vendorBill.findFirstOrThrow({
      where: { id: billId, organization: { slug: org } },
    });
    const ctx = await requireProjectContext(org, bill.projectId);
    assertPermission(ctx, "bill.create");
    const file = billAttachmentInput.parse(data.get("file"));
    const key = await storage.put(new Uint8Array(await file.arrayBuffer()));
    try {
      await db.$transaction(async (tx) => {
        await lockDocument(tx, "BILL", bill.id);
        await tx.vendorBill.findFirstOrThrow({
          where: { id: bill.id, organizationId: ctx.org.id, status: "DRAFT" },
        });
        await createBillAttachment(tx, ctx, bill.id, file, key);
      });
    } catch (error) {
      await storage.delete(key).catch(() => {});
      throw error;
    }
  });
}
