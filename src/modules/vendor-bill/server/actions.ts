"use server";
import type { ActionState } from "@/core/action-result";
import { runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { storage } from "@/core/storage";
import {
  domainAudit,
  lockDocument,
} from "@/modules/procurement/server/service";
import { billInput } from "../schema";
import { assertBillReceipts, saveBill } from "./service";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export async function saveBillAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const input = billInput.parse({
      ...Object.fromEntries(data),
      id: value(data, "id") || null,
      purchaseOrderId: value(data, "purchaseOrderId") || null,
      dueDate: value(data, "dueDate") || null,
      lines: JSON.parse(value(data, "lines")),
    });
    const ctx = await requireProjectContext(org, input.projectId);
    assertPermission(ctx, "bill.create");
    const bill = await db.$transaction((tx) => saveBill(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/procurement/bills/${bill.id}`;
  });
}
export async function submitBillAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const documentId = id.parse(value(data, "id"));
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
  });
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
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 900000)
      throw new Error("Select a PDF or image up to 900 KB.");
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type))
      throw new Error("Only PDF, PNG and JPEG files are supported.");
    const key = await storage.put(new Uint8Array(await file.arrayBuffer()));
    try {
      await db.$transaction(async (tx) => {
        await lockDocument(tx, "BILL", bill.id);
        await tx.vendorBill.findFirstOrThrow({
          where: { id: bill.id, organizationId: ctx.org.id, status: "DRAFT" },
        });
        const attachment = await tx.attachment.create({
          data: {
            organizationId: ctx.org.id,
            entityType: "VendorBill",
            entityId: bill.id,
            filename: file.name.slice(0, 200),
            mimeType: file.type,
            sizeBytes: file.size,
            storageKey: key,
            uploadedById: ctx.user.id,
          },
        });
        await domainAudit(ctx, tx, "Attachment", attachment.id, "CREATE");
      });
    } catch (error) {
      await storage.delete(key).catch(() => {});
      throw error;
    }
  });
}
