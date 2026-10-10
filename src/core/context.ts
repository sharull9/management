import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/core/auth/auth";
import { db } from "./db";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (
    session.user.banned &&
    (!session.user.banExpires || new Date(session.user.banExpires) > new Date())
  )
    throw new Error("Account suspended.");
  return session.user;
});
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
}
export const requireOrgContext = cache(async (orgSlug: string) => {
  const user = await requireUser();
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    include: { tenant: true },
  });
  if (!org) notFound();
  const [tenantMember, member] = await Promise.all([
    db.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: org.tenantId, userId: user.id } },
    }),
    db.member.findUnique({
      where: {
        organizationId_userId: { organizationId: org.id, userId: user.id },
      },
      include: { customRole: true },
    }),
  ]);
  const tenantRole = tenantMember?.role ?? null;
  const tenantAdmin = tenantRole === "OWNER" || tenantRole === "ADMIN";
  if (!tenantMember || (!member && !tenantAdmin)) notFound();
  if (org.tenant.status === "SUSPENDED")
    throw new Error(
      "This tenant is suspended. Contact the platform administrator.",
    );
  const isAdmin =
    tenantAdmin || member?.role === "owner" || member?.role === "admin";
  const permissions = new Set(
    member?.customRole?.tenantId === org.tenantId
      ? member.customRole.permissions
      : [],
  );
  return {
    user,
    tenant: org.tenant,
    org,
    member,
    tenantRole,
    permissions,
    isAdmin,
  };
});
export type OrgContext = Awaited<ReturnType<typeof requireOrgContext>>;
export function assertPermission(ctx: OrgContext, permission: string) {
  if (!ctx.isAdmin && !ctx.permissions.has(permission))
    throw new Error("You do not have permission to perform this action.");
}
export const requireProjectContext = cache(
  async (orgSlug: string, projectId: string) => {
    const ctx = await requireOrgContext(orgSlug);
    const project = await db.project.findFirst({
      where: { id: projectId, organizationId: ctx.org.id },
      include: {
        members: { where: { userId: ctx.user.id }, include: { role: true } },
      },
    });
    if (!project) notFound();
    const membership = project.members[0];
    const isProjectManager =
      project.managerUserId === ctx.user.id || !!membership?.isManager;
    const permissions = new Set(ctx.permissions);
    if (membership?.role?.tenantId === ctx.tenant.id)
      for (const key of membership.role.permissions) permissions.add(key);
    if (membership || isProjectManager) permissions.add("project.view");
    if (isProjectManager)
      for (const key of [
        "project.edit",
        "stage.manage",
        "task.manage",
        "task.submit",
        "task.delay.request",
        "attendance.record",
        "cost.view",
        "expense.create",
        "purchase.view",
        "purchase.request.create",
        "purchase.order.create",
        "grn.create",
        "inventory.view",
        "inventory.consume",
        "inventory.transfer",
      ])
        permissions.add(key);
    const scoped = {
      ...ctx,
      project,
      projectMember: membership,
      isProjectManager,
      permissions,
    };
    assertPermission(scoped, "project.view");
    return scoped;
  },
);
export function projectAccessWhere(ctx: OrgContext) {
  return ctx.isAdmin || ctx.permissions.has("project.view")
    ? {}
    : {
        OR: [
          { managerUserId: ctx.user.id },
          { members: { some: { userId: ctx.user.id } } },
        ],
      };
}
export function assertTenantAdmin(ctx: OrgContext) {
  if (ctx.tenantRole !== "OWNER" && ctx.tenantRole !== "ADMIN")
    throw new Error("Tenant owner or administrator access is required.");
}
export function projectCostAccessWhere(ctx: OrgContext) {
  return ctx.isAdmin || ctx.permissions.has("cost.view")
    ? projectAccessWhere(ctx)
    : {
        AND: [projectAccessWhere(ctx)],
        OR: [
          { managerUserId: ctx.user.id },
          { members: { some: { userId: ctx.user.id, isManager: true } } },
          {
            members: {
              some: {
                userId: ctx.user.id,
                role: {
                  tenantId: ctx.tenant.id,
                  permissions: { has: "cost.view" },
                },
              },
            },
          },
        ],
      };
}
export function canViewProjectCost(
  ctx: OrgContext,
  project: {
    managerUserId: string | null;
    members: {
      isManager: boolean;
      role: { tenantId: string; permissions: string[] } | null;
    }[];
  },
) {
  return (
    ctx.isAdmin ||
    ctx.permissions.has("cost.view") ||
    project.managerUserId === ctx.user.id ||
    project.members.some(
      (m) =>
        m.isManager ||
        (m.role?.tenantId === ctx.tenant.id &&
          m.role.permissions.includes("cost.view")),
    )
  );
}
export async function listAccessibleOrgs(userId: string) {
  return db.organization.findMany({
    where: {
      tenant: { status: "ACTIVE", members: { some: { userId } } },
      OR: [
        { members: { some: { userId } } },
        {
          tenant: {
            members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } },
          },
        },
      ],
    },
    include: { tenant: true },
    orderBy: { name: "asc" },
  });
}
