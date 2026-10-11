import "server-only";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { domainAudit } from "@/modules/procurement/server/service";

export async function createBillAttachment(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  billId: string,
  file: File,
  storageKey: string,
) {
  const attachment = await tx.attachment.create({
    data: {
      organizationId: ctx.org.id,
      entityType: "VendorBill",
      entityId: billId,
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
      uploadedById: ctx.user.id,
    },
  });
  await domainAudit(ctx, tx, "Attachment", attachment.id, "CREATE");
}
