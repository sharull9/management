"use server";
import { z } from "zod";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { storage } from "@/core/storage";
import {
  consumptionInput,
  orderInput,
  receiptInput,
  requestInput,
  transferInput,
} from "../schema";
import { documentKinds } from "./approval";
import { recordConsumption, saveStockTransfer } from "./inventory/service";
import { savePurchaseOrder } from "./order-service";
import { saveGoodsReceipt } from "./receipt-service";
import { savePurchaseRequest } from "./request-service";
import { domainAudit } from "./service";
import { submitDocument } from "./submission";

const val = (data: FormData, key: string) => String(data.get(key) ?? "");
const opt = (data: FormData, key: string) => val(data, key).trim() || null;
export async function saveProcurementAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const kind = z
      .enum(["requests", "orders", "receipts", "consumption", "transfers"])
      .parse(val(data, "kind"));
    const projectId = id.parse(val(data, "projectId"));
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(
      ctx,
      kind === "consumption"
        ? "inventory.consume"
        : documentKinds[kind].permission,
    );
    const raw = {
      ...Object.fromEntries(data),
      id: opt(data, "id"),
      stageId: opt(data, "stageId"),
      taskId: opt(data, "taskId"),
      neededBy: opt(data, "neededBy"),
      siteId: opt(data, "siteId"),
      challanNumber: opt(data, "challanNumber"),
      vehicleNumber: opt(data, "vehicleNumber"),
      lines: JSON.parse(val(data, "lines")),
    };
    if (kind === "transfers") {
      const to = await requireProjectContext(
        org,
        id.parse(val(data, "toProjectId")),
      );
      assertPermission(to, "inventory.transfer");
    }
    const row = await db.$transaction(
      async (tx) => {
        switch (kind) {
          case "requests":
            return savePurchaseRequest(tx, ctx, requestInput.parse(raw));
          case "orders":
            return savePurchaseOrder(tx, ctx, orderInput.parse(raw));
          case "receipts":
            return saveGoodsReceipt(tx, ctx, receiptInput.parse(raw));
          case "consumption":
            return recordConsumption(tx, ctx, consumptionInput.parse(raw));
          case "transfers":
            return saveStockTransfer(tx, ctx, transferInput.parse(raw));
        }
      },
      { timeout: 20000 },
    );
    return kind === "consumption"
      ? `/${org}/inventory/consumption?projectId=${projectId}`
      : `/${org}/${kind === "transfers" ? "inventory" : "procurement"}/${kind}/${row.id}`;
  });
}
export async function submitProcurementAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const kind = z
      .enum(["requests", "orders", "receipts", "transfers"])
      .parse(val(data, "kind"));
    const documentId = id.parse(val(data, "id"));
    const where = { id: documentId, organization: { slug: org } };
    const row =
      kind === "requests"
        ? await db.purchaseRequest.findFirstOrThrow({ where })
        : kind === "orders"
          ? await db.purchaseOrder.findFirstOrThrow({ where })
          : kind === "receipts"
            ? await db.goodsReceipt.findFirstOrThrow({ where })
            : await db.stockTransfer.findFirstOrThrow({ where });
    const ctx = await requireProjectContext(org, row.projectId);
    assertPermission(ctx, documentKinds[kind].permission);
    if ("toProjectId" in row) {
      const dest = await requireProjectContext(org, row.toProjectId);
      assertPermission(dest, "inventory.transfer");
    }
    await db.$transaction((tx) => submitDocument(tx, ctx, kind, documentId), {
      timeout: 20000,
    });
  });
}
export async function attachProformaAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const orderId = id.parse(val(data, "id"));
    const row = await db.purchaseOrder.findFirstOrThrow({
      where: { id: orderId, organization: { slug: org } },
    });
    const ctx = await requireProjectContext(org, row.projectId);
    assertPermission(ctx, "purchase.order.create");
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 900000)
      throw new Error("Select a PDF or image up to 900 KB.");
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type))
      throw new Error("Only PDF, PNG and JPEG files are supported.");
    const key = await storage.put(new Uint8Array(await file.arrayBuffer()));
    try {
      await db.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({
          data: {
            organizationId: ctx.org.id,
            entityType: "PurchaseOrder",
            entityId: row.id,
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
