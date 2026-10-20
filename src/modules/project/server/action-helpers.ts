import { writeAudit } from "@/core/audit";
import type { OrgContext } from "@/core/context";
import { UserFacingError } from "@/core/errors";
import { optional, value } from "@/core/form-data";
import { date } from "@/core/schema";
import type { Prisma } from "@/generated/prisma/client";

export {
  canManageProjectApprovers,
  canViewCompensation,
} from "../access-policy";
export const nullableDate = (data: FormData, key: string) =>
  optional(data, key) ? date.parse(value(data, key)) : null;
export function dateOrder(start: Date | null, end: Date | null) {
  if (start && end && end < start)
    throw new UserFacingError("End date must be on or after start date.");
}
export async function audit(
  ctx: OrgContext,
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
  changes?: Prisma.InputJsonValue,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
      changes,
    },
    tx,
  );
}
export async function member(
  ctx: OrgContext,
  tx: Prisma.TransactionClient,
  userId: string | null,
) {
  if (
    userId &&
    !(await tx.member.findFirst({
      where: { organizationId: ctx.org.id, userId },
    }))
  )
    throw new UserFacingError("Select a member of this organization.");
}
export async function stageInProject(
  tx: Prisma.TransactionClient,
  projectId: string,
  stageId: string | null,
) {
  if (
    stageId &&
    !(await tx.stage.findFirst({ where: { id: stageId, projectId } }))
  )
    throw new UserFacingError("Stage does not belong to this project.");
}
