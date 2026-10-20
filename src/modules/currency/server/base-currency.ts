import { UserFacingError } from "@/core/errors";
import type { Prisma } from "@/generated/prisma/client";

export type BaseCurrencyUsage = {
  costEntries: number;
  stockMovements: number;
  documents: number;
  exchangeRates: number;
};

/** Everything that was valued or posted in the current base currency. */
export async function countBaseCurrencyUsage(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<BaseCurrencyUsage> {
  const org = { organizationId };
  const posted = { organizationId, status: { not: "DRAFT" as const } };
  const [costEntries, stockMovements, ...documents] = await Promise.all([
    tx.costEntry.count({ where: org }),
    tx.stockMovement.count({ where: org }),
    tx.purchaseOrder.count({ where: posted }),
    tx.goodsReceipt.count({ where: posted }),
    tx.vendorBill.count({ where: posted }),
    tx.paymentRequest.count({ where: posted }),
    tx.salesInvoice.count({ where: posted }),
    // Payments are posted on creation; expenses have no draft state.
    tx.payment.count({ where: org }),
    tx.expense.count({ where: { project: org } }),
    // Asset rates and their snapshots are denominated in the base currency.
    tx.asset.count({ where: org }),
    tx.journalEntry.count({ where: posted }),
  ]);
  const exchangeRates = await tx.exchangeRate.count({ where: org });
  return {
    costEntries,
    stockMovements,
    documents: documents.reduce((sum, n) => sum + n, 0),
    exchangeRates,
  };
}

export function baseCurrencyLockReasons(usage: BaseCurrencyUsage) {
  const reasons: string[] = [];
  if (usage.costEntries) reasons.push(`${usage.costEntries} cost entries`);
  if (usage.stockMovements)
    reasons.push(`${usage.stockMovements} stock movements`);
  if (usage.documents)
    reasons.push(`${usage.documents} non-draft financial documents`);
  if (usage.exchangeRates)
    reasons.push(
      `${usage.exchangeRates} exchange rates (rates are relative to the base currency; delete them first)`,
    );
  return reasons;
}

/** Throws when the organization's base currency can no longer change. */
export async function assertBaseCurrencyChangeAllowed(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const reasons = baseCurrencyLockReasons(
    await countBaseCurrencyUsage(tx, organizationId),
  );
  if (reasons.length)
    throw new UserFacingError(
      `The base currency cannot be changed because this organization already has ${reasons.join(", ")}.`,
    );
}
