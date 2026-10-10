import "server-only";
import type {
  ApprovalRequest,
  ApprovalRequestStep,
  ApproverType,
  Prisma,
} from "@/generated/prisma/client";
import type { OrgContext } from "../context";
import { db } from "../db";

type ManagerResolver = (
  request: ApprovalRequest,
  type: ApproverType,
  tx: Prisma.TransactionClient,
) => Promise<string[] | null>;
let managerResolver: ManagerResolver = async () => null;
export function registerManagerResolver(resolver: ManagerResolver) {
  managerResolver = resolver;
}

export async function canActOnStep(
  ctx: OrgContext,
  step: ApprovalRequestStep,
  request: ApprovalRequest,
  tx: Prisma.TransactionClient = db,
) {
  if (
    step.status !== "PENDING" ||
    request.status !== "PENDING" ||
    request.organizationId !== ctx.org.id
  )
    return false;
  if (step.approverType === "USER") return step.userId === ctx.user.id;
  if (step.approverType === "ROLE")
    return !!step.roleId && ctx.member?.roleId === step.roleId;
  const managers = await managerResolver(request, step.approverType, tx);
  return managers?.length ? managers.includes(ctx.user.id) : ctx.isAdmin;
}
