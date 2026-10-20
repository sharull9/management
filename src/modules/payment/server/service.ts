import { UserFacingError } from "@/core/errors";
import "server-only";
import { writeAudit } from "@/core/audit";
import { assertPermission, type OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { lockAccountingScope } from "@/modules/accounting/server/locking";
import { assertSameCurrency } from "@/modules/currency/util";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { settledStatuses } from "./allocation";

type Tx = Prisma.TransactionClient;
export async function lockSettlement(tx: Tx, organizationId: string) {
  await lockAccountingScope(tx, organizationId);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`settlement:${organizationId}`}))::text`;
}
export async function audit(
  tx: Tx,
  ctx: OrgContext,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
    },
    tx,
  );
}
export async function scope(
  tx: Tx,
  ctx: OrgContext,
  projectId: string | null,
  permission: string,
) {
  assertPermission(ctx, permission);
  if (
    "project" in ctx &&
    (ctx as OrgContext & { project: { id: string } }).project.id !== projectId
  )
    throw new UserFacingError("Document is outside the authorized project.");
  if (!projectId) return ctx.org.baseCurrency;
  const p = await tx.project.findFirstOrThrow({
    where: { ...moduleProjectWhere(ctx, permission), id: projectId },
  });
  return p.currency;
}
export async function target(
  tx: Tx,
  ctx: OrgContext,
  payment: {
    direction: string;
    partyId: string;
    currency: string;
    projectId: string | null;
  },
  documentId: string,
  permission: string,
) {
  const where = {
    id: documentId,
    organizationId: ctx.org.id,
    partyId: payment.partyId,
    status: { in: [...settledStatuses] },
    ...(payment.projectId ? { projectId: payment.projectId } : {}),
  };
  const row =
    payment.direction === "OUTGOING"
      ? await tx.vendorBill.findFirstOrThrow({ where })
      : await tx.salesInvoice.findFirstOrThrow({ where });
  assertSameCurrency(payment.currency, row.currency, "Payment");
  await scope(tx, ctx, row.projectId, permission);
  return {
    row,
    outstanding: row.payableTotal.sub(
      "paidTotal" in row ? row.paidTotal : row.receivedTotal,
    ),
  };
}
