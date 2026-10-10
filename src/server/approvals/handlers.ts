import "server-only";
import type {
  ApprovalRequest,
  DocumentType,
  Prisma,
} from "@/generated/prisma/client";

type Handler = (
  request: ApprovalRequest,
  tx: Prisma.TransactionClient,
) => Promise<void>;
export type ApprovalHandler = { onApproved: Handler; onRejected: Handler };
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
// Register future document handlers in a server bootstrap imported by this module.
// Handlers must use the supplied transaction and avoid external side effects.
