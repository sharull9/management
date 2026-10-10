import "server-only";
import type {
  ApprovalRequest,
  DocumentType,
  Prisma,
} from "@/generated/prisma/client";

type Handler = (
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
  actorId: string,
) => Promise<void>;
export type ApprovalHandler = {
  onApproved: Handler;
  onRejected: Handler;
  onCanceled?: Handler;
};
const handlers = new Map<DocumentType, ApprovalHandler>();
export function registerApprovalHandler(
  type: DocumentType,
  handler: ApprovalHandler,
) {
  handlers.set(type, handler);
}
export function getApprovalHandler(type: DocumentType) {
  return handlers.get(type);
}
