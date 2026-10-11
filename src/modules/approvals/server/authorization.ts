import "server-only";
import { db } from "@/core/db";
import type {
  ApprovalRequest,
  ApprovalRequestStep,
  ApproverType,
  Prisma,
} from "@/generated/prisma/client";

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
  ctx: {
    user: { id: string };
    org: { id: string };
    member: { roleId: string | null } | null;
    isAdmin: boolean;
  },
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

export async function listEligibleApprovers(
  step: ApprovalRequestStep,
  request: ApprovalRequest,
  tx: Prisma.TransactionClient = db,
) {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: request.organizationId },
  });
  const candidates = await tx.tenantMember.findMany({
    where: { tenantId: org.tenantId },
    include: {
      user: { include: { members: { where: { organizationId: org.id } } } },
    },
  });
  const eligible: string[] = [];
  for (const candidate of candidates) {
    const user = candidate.user;
    if (user.banned && (!user.banExpires || user.banExpires > new Date()))
      continue;
    const member = user.members[0] ?? null;
    const tenantAdmin =
      candidate.role === "OWNER" || candidate.role === "ADMIN";
    if (!member && !tenantAdmin) continue;
    if (
      await canActOnStep(
        {
          user,
          org,
          member,
          isAdmin:
            tenantAdmin || member?.role === "owner" || member?.role === "admin",
        },
        step,
        request,
        tx,
      )
    )
      eligible.push(user.id);
  }
  return eligible;
}
