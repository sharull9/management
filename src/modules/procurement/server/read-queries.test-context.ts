import type { OrgContext } from "@/core/context";

type ProjectContext = OrgContext & { project: { id: string } };
const state = globalThis as typeof globalThis & {
  __procurementReadContexts: {
    org: OrgContext;
    projects: Map<string, ProjectContext>;
  };
};

export async function requireOrgContext() {
  return state.__procurementReadContexts.org;
}

export async function requireProjectContext(_org: string, projectId: string) {
  const context = state.__procurementReadContexts.projects.get(projectId);
  if (!context) throw new Error("Project context not found.");
  return context;
}

export function assertPermission(ctx: OrgContext, permission: string) {
  if (!ctx.isAdmin && !ctx.permissions.has(permission))
    throw new Error(`Missing permission: ${permission}`);
}

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
