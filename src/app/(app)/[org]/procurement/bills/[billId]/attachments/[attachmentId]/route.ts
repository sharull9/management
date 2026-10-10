import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { storage } from "@/core/storage";
export async function GET(
  _: Request,
  {
    params,
  }: { params: Promise<{ org: string; billId: string; attachmentId: string }> },
) {
  const { org, billId, attachmentId } = await params;
  const bill = await db.vendorBill.findFirst({
    where: { id: billId, organization: { slug: org } },
  });
  if (!bill) return new Response("Not found", { status: 404 });
  const ctx = await requireProjectContext(org, bill.projectId);
  assertPermission(ctx, "bill.view");
  const attachment = await db.attachment.findFirst({
    where: {
      id: attachmentId,
      entityType: "VendorBill",
      entityId: bill.id,
      organizationId: ctx.org.id,
    },
  });
  if (!attachment) return new Response("Not found", { status: 404 });
  return new Response(await storage.get(attachment.storageKey), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
