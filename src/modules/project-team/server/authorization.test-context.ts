import type {
  requireProjectContext as getProjectContext,
  OrgContext,
} from "@/core/context";

type ProjectContext = Awaited<ReturnType<typeof getProjectContext>>;
const testContexts = globalThis as typeof globalThis & {
  __authorizationTestContexts: { org: OrgContext; project: ProjectContext };
};

export const requireOrgContext = async () =>
  testContexts.__authorizationTestContexts.org;
export const requireProjectContext = async () =>
  testContexts.__authorizationTestContexts.project;
export function assertPermission(ctx: OrgContext, permission: string) {
  if (!ctx.isAdmin && !ctx.permissions.has(permission))
    throw new Error("You do not have permission to perform this action.");
}
