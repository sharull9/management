import { UserFacingError } from "@/core/errors";
import "server-only";
import { assertPermission, type OrgContext } from "@/core/context";
import type { FinanceDocumentStatus, Prisma } from "@/generated/prisma/client";
import { ensureOrgChart } from "./chart-service";
import { lockAccountingScope } from "./locking";
import { syncCostEntryJournal } from "./source-costs";
import { syncPaymentJournals } from "./source-payments";
import { syncVendorBillJournal } from "./source-procurement";
import { syncSalesInvoiceJournal } from "./source-sales";
import { syncStockMovementJournal } from "./source-stock";

const categories = ["stock", "bill", "invoice", "payment", "cost"] as const;
export type HistoryCategory = (typeof categories)[number];
export type HistoryCursor = {
  organizationId: string;
  category: HistoryCategory;
  afterId: string;
};
const batchSize = 10;

function continuation(
  organizationId: string,
  category: HistoryCategory,
  rows: { id: string }[],
  afterId: string,
): HistoryCursor | null {
  if (rows.length > batchSize) {
    return {
      organizationId,
      category,
      afterId: rows[batchSize - 1]?.id ?? afterId,
    };
  }
  const next = categories[categories.indexOf(category) + 1];
  return next ? { organizationId, category: next, afterId: "" } : null;
}

function validateCursor(
  value: unknown,
  organizationId: string,
): HistoryCursor | null {
  if (value == null) return null;
  if (
    typeof value !== "object" ||
    !("organizationId" in value) ||
    !("category" in value) ||
    !("afterId" in value)
  )
    throw new UserFacingError("Invalid accounting history cursor.");
  const cursor = value as Record<string, unknown>;
  if (
    cursor.organizationId !== organizationId ||
    typeof cursor.category !== "string" ||
    !categories.includes(cursor.category as HistoryCategory) ||
    typeof cursor.afterId !== "string"
  )
    throw new UserFacingError("Invalid accounting history cursor.");
  return cursor as HistoryCursor;
}

/** Synchronizes one bounded source page; each payment and all its dependent journals stay together. */
export async function syncAccountingHistoryBatch(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  rawCursor?: unknown,
) {
  assertPermission(ctx, "accounting.manage");
  const org = await tx.organization.findUnique({
    where: { id: ctx.org.id },
    select: { id: true, tenantId: true },
  });
  if (!org || org.tenantId !== ctx.tenant.id)
    throw new UserFacingError("Organization does not belong to this tenant.");
  await lockAccountingScope(tx, org.id);
  await ensureOrgChart(tx, org.id, ctx.user.id);
  const cursor = validateCursor(rawCursor, org.id);
  const category = cursor?.category ?? categories[0];
  const afterId = cursor?.afterId ?? "";
  const page = { id: { gt: afterId } };
  let sources = 0;
  let nextCursor: HistoryCursor | null = null;

  if (category === "stock") {
    const rows = await tx.stockMovement.findMany({
      where: { organizationId: org.id, type: { not: "ADJUSTMENT" }, ...page },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize + 1,
    });
    for (const row of rows.slice(0, batchSize)) {
      await syncStockMovementJournal(tx, org.id, row.id, ctx.user.id);
      sources++;
    }
    nextCursor = continuation(org.id, category, rows, afterId);
  } else if (category === "bill") {
    const rows = await tx.vendorBill.findMany({
      where: {
        organizationId: org.id,
        status: {
          in: ["APPROVED", "PARTIALLY_PAID", "PAID"] as FinanceDocumentStatus[],
        },
        ...page,
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize + 1,
    });
    for (const row of rows.slice(0, batchSize)) {
      await syncVendorBillJournal(tx, org.id, row.id, ctx.user.id);
      sources++;
    }
    nextCursor = continuation(org.id, category, rows, afterId);
  } else if (category === "invoice") {
    const rows = await tx.salesInvoice.findMany({
      where: {
        organizationId: org.id,
        status: {
          in: ["APPROVED", "PARTIALLY_PAID", "PAID"] as FinanceDocumentStatus[],
        },
        ...page,
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize + 1,
    });
    for (const row of rows.slice(0, batchSize)) {
      await syncSalesInvoiceJournal(tx, org.id, row.id, ctx.user.id);
      sources++;
    }
    nextCursor = continuation(org.id, category, rows, afterId);
  } else if (category === "payment") {
    const rows = await tx.payment.findMany({
      where: { organizationId: org.id, ...page },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize + 1,
    });
    for (const row of rows.slice(0, batchSize)) {
      await syncPaymentJournals(tx, org.id, row.id, ctx.user.id);
      sources++;
    }
    nextCursor = continuation(org.id, category, rows, afterId);
  } else {
    const rows = await tx.costEntry.findMany({
      where: {
        organizationId: org.id,
        sourceType: {
          in: [
            "ATTENDANCE",
            "EXPENSE",
            "ASSET_TRIP",
            "ASSET_USAGE",
            "ASSET_ELECTRICITY",
            "ASSET_FUEL",
          ],
        },
        ...page,
      },
      orderBy: { id: "asc" },
      take: batchSize + 1,
    });
    for (const row of rows.slice(0, batchSize)) {
      await syncCostEntryJournal(tx, row, ctx.user.id);
      sources++;
    }
    nextCursor = continuation(org.id, category, rows, afterId);
  }
  return { sources, nextCursor, done: nextCursor === null };
}

// Legacy transaction callers retain full traversal; UI callers use the batch API.
export async function syncAccountingHistory(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
) {
  let cursor: HistoryCursor | null = null;
  let sources = 0;
  while (true) {
    const progress = await syncAccountingHistoryBatch(tx, ctx, cursor);
    sources += progress.sources;
    if (progress.done) return { sources, nextCursor: null, done: true };
    cursor = progress.nextCursor;
  }
}
