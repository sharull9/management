import { requireOrgContext, requireProjectContext } from "@/server/context";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
    include: { organization: true },
  });
  if (!attachment) return new Response("Not found", { status: 404 });
  await requireOrgContext(attachment.organization.slug);
  if (attachment.entityType !== "TaskSubmission")
    return new Response("Not found", { status: 404 });
  const submission = await db.taskSubmission.findFirst({
    where: {
      id: attachment.entityId,
      task: { project: { organizationId: attachment.organizationId } },
    },
    include: { task: true },
  });
  if (!submission) return new Response("Not found", { status: 404 });
  await requireProjectContext(
    attachment.organization.slug,
    submission.task.projectId,
  );
  const bytes = await storage.get(attachment.storageKey);
  return new Response(bytes, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
