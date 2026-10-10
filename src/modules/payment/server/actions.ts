"use server";
import { z } from "zod";
import { type ActionState, runAction } from "@/core/action-result";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { allocationsInput, id, paymentInput, requestInput } from "../schema";
import { allocatePayment } from "./allocation-service";
import { recordPayment } from "./payment-service";
import { saveRequest } from "./request-service";
import { submitRequest } from "./submission";
import { voidPayment } from "./void-service";

const val = (data: FormData, key: string) => String(data.get(key) ?? "");
const optional = (data: FormData, key: string) => val(data, key).trim() || null;
async function context(
  org: string,
  projectId: string | null,
  permission: string,
) {
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  assertPermission(ctx, permission);
  return ctx;
}
export async function saveRequestAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const input = requestInput.parse({
      ...Object.fromEntries(data),
      id: optional(data, "id"),
      projectId: optional(data, "projectId"),
      allocations: JSON.parse(val(data, "allocations") || "[]"),
    });
    const ctx = await context(org, input.projectId, "payment.request.create");
    const row = await db.$transaction((tx) => saveRequest(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/finance/payment-requests/${row.id}`;
  });
}
export async function submitRequestAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const documentId = id.parse(val(data, "id"));
    const row = await db.paymentRequest.findFirstOrThrow({
      where: { id: documentId, organization: { slug: org } },
    });
    const ctx = await context(org, row.projectId, "payment.request.create");
    await db.$transaction((tx) => submitRequest(tx, ctx, documentId), {
      timeout: 20000,
    });
  });
}
export async function recordPaymentAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const input = paymentInput.parse({
      ...Object.fromEntries(data),
      projectId: optional(data, "projectId"),
      paymentRequestId: optional(data, "paymentRequestId"),
    });
    const ctx = await context(org, input.projectId, "payment.record");
    const row = await db.$transaction((tx) => recordPayment(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/finance/payments/${row.id}`;
  });
}
export async function allocatePaymentAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const paymentId = id.parse(val(data, "id"));
    const lines = allocationsInput
      .min(1)
      .parse(JSON.parse(val(data, "allocations") || "[]"));
    const row = await db.payment.findFirstOrThrow({
      where: { id: paymentId, organization: { slug: org } },
    });
    const ctx = await context(org, row.projectId, "payment.record");
    await db.$transaction((tx) => allocatePayment(tx, ctx, paymentId, lines), {
      timeout: 20000,
    });
  });
}
export async function voidPaymentAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const paymentId = id.parse(val(data, "id")),
      reason = z.string().trim().min(1).max(1000).parse(val(data, "reason"));
    const row = await db.payment.findFirstOrThrow({
      where: { id: paymentId, organization: { slug: org } },
    });
    const ctx = await context(org, row.projectId, "payment.record");
    await db.$transaction((tx) => voidPayment(tx, ctx, paymentId, reason), {
      timeout: 20000,
    });
  });
}
