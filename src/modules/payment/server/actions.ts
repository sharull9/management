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
  allocationActionInput,
  paymentInput,
  requestInput,
  submitRequestInput,
  voidPaymentInput,
} from "../schema";
import { allocatePayment } from "./allocation-service";
import { recordPayment } from "./payment-service";
import { saveRequest } from "./request-service";
import { submitRequest } from "./submission";
import { voidPayment } from "./void-service";

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
  input: z.input<typeof requestInput>,
) {
  return typedAction(requestInput, async (input) => {
    const ctx = await context(org, input.projectId, "payment.request.create");
    const row = await db.$transaction((tx) => saveRequest(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/finance/payment-requests/${row.id}`;
  })(input);
}
export async function submitRequestAction(
  org: string,
  input: z.input<typeof submitRequestInput>,
) {
  return typedAction(submitRequestInput, async (input) => {
    const documentId = input.id;
    const row = await db.paymentRequest.findFirstOrThrow({
      where: { id: documentId, organization: { slug: org } },
    });
    const ctx = await context(org, row.projectId, "payment.request.create");
    await db.$transaction((tx) => submitRequest(tx, ctx, documentId), {
      timeout: 20000,
    });
  })(input);
}
export async function recordPaymentAction(
  org: string,
  input: z.input<typeof paymentInput>,
) {
  return typedAction(paymentInput, async (input) => {
    const ctx = await context(org, input.projectId, "payment.record");
    const row = await db.$transaction((tx) => recordPayment(tx, ctx, input), {
      timeout: 20000,
    });
    return `/${org}/finance/payments/${row.id}`;
  })(input);
}
export async function allocatePaymentAction(
  org: string,
  input: z.input<typeof allocationActionInput>,
) {
  return typedAction(allocationActionInput, async (input) => {
    const paymentId = input.id;
    const lines = input.allocations;
    const row = await db.payment.findFirstOrThrow({
      where: { id: paymentId, organization: { slug: org } },
    });
    const ctx = await context(org, row.projectId, "payment.record");
    await db.$transaction((tx) => allocatePayment(tx, ctx, paymentId, lines), {
      timeout: 20000,
    });
  })(input);
}
export async function voidPaymentAction(
  org: string,
  input: z.input<typeof voidPaymentInput>,
) {
  return typedAction(voidPaymentInput, async (input) => {
    const { id: paymentId, reason } = input;
    const row = await db.payment.findFirstOrThrow({
      where: { id: paymentId, organization: { slug: org } },
    });
    const ctx = await context(org, row.projectId, "payment.record");
    await db.$transaction((tx) => voidPayment(tx, ctx, paymentId, reason), {
      timeout: 20000,
    });
  })(input);
}
