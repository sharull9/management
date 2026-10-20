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
type ManagerCache = Map<string, Promise<string[] | null>>;
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
  managersByScope?: ManagerCache,
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
  const key = JSON.stringify([
    request.organizationId,
    request.projectId,
    step.approverType,
    step.approverType === "STAGE_MANAGER" ? request.stageId : null,
  ]);
  let lookup = managersByScope?.get(key);
  if (!lookup) {
    lookup = managerResolver(request, step.approverType, tx);
    managersByScope?.set(key, lookup);
  }
  const managers = await lookup;
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
  const managersByScope: ManagerCache = new Map();
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
        managersByScope,
      )
    )
      eligible.push(user.id);
  }
  return eligible;
}
