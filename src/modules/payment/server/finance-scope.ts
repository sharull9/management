import "server-only";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";

export async function financeScope(
  org: string,
  permission: string,
  projectId?: string,
) {
  const orgCtx = await requireOrgContext(org);
  const ctx = projectId ? await requireProjectContext(org, projectId) : orgCtx;
  const canViewOrg = orgCtx.isAdmin || orgCtx.permissions.has(permission);
  const global = ctx.isAdmin || ctx.permissions.has(permission);
  if (projectId) assertPermission(ctx, permission);
  const projects = await db.project.findMany({
    where: {
      ...moduleProjectWhere(ctx, permission),
      ...(projectId ? { id: projectId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const ids = projects.map((p) => p.id);
  if (!global && !ids.length) assertPermission(ctx, permission);
  if (projectId && !ids.includes(projectId))
    throw new UserFacingError("Project is not accessible.");
  const scopedWhere = {
    organizationId: ctx.org.id,
    ...(projectId
      ? { projectId }
      : {
          OR: [
            ...(global ? [{ projectId: null }] : []),
            { projectId: { in: ids } },
          ],
        }),
  };
  return { orgCtx, ctx, projects, ids, canViewOrg, global, scopedWhere };
}

export function visiblePaymentRow<
  T extends {
    projectId: string | null;
    project: { id: string; name: string } | null;
  },
>(payment: T, scope: { canViewOrg: boolean; ids: string[] }) {
  const hiddenProject =
    !scope.canViewOrg &&
    payment.projectId !== null &&
    !scope.ids.includes(payment.projectId);
  return {
    ...payment,
    projectId: hiddenProject ? null : payment.projectId,
    project: hiddenProject ? null : payment.project,
    projectLabel: hiddenProject
      ? "Project not available"
      : (payment.project?.name ?? "Organization"),
  };
}
