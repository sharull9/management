import "server-only";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { approvalDocumentLinks } from "./document-link";
import { listPendingForUser } from "./service";
export async function approvalInbox(org: string) {
  const ctx = await requireOrgContext(org);
  const canViewAll = ctx.isAdmin || ctx.permissions.has("approval.view");
  const [pending, history] = await Promise.all([
    listPendingForUser(org),
    db.approvalRequest.findMany({
      where: {
        organizationId: ctx.org.id,
        ...(canViewAll
          ? {}
          : {
              OR: [
                { requestedById: ctx.user.id },
                {
                  steps: {
                    some: {
                      OR: [
                        { userId: ctx.user.id },
                        { actedById: ctx.user.id },
                        ...(ctx.member?.roleId
                          ? [{ roleId: ctx.member.roleId }]
                          : []),
                      ],
                    },
                  },
                },
              ],
            }),
      },
      include: {
        steps: {
          include: { actedBy: { select: { name: true } } },
          orderBy: { sequence: "asc" },
        },
        requestedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const links = await approvalDocumentLinks(org, [
    ...pending.map((s) => s.request),
    ...history,
  ]);
  return { ctx, pending, history, links };
}
export async function approvalPolicyData(org: string) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "approval.policy.manage");
  const [policies, roles, members, projects, stages] = await Promise.all([
    db.approvalPolicy.findMany({
      where: { organizationId: ctx.org.id },
      include: { steps: { orderBy: { sequence: "asc" } } },
      orderBy: { documentType: "asc" },
    }),
    db.role.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true },
    }),
    db.member.findMany({
      where: { organizationId: ctx.org.id },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.project.findMany({
      where: { organizationId: ctx.org.id },
      select: { id: true, name: true },
    }),
    db.stage.findMany({
      where: { project: { organizationId: ctx.org.id } },
      select: { id: true, name: true, projectId: true },
    }),
  ]);
  return { policies, roles, members, projects, stages };
}
