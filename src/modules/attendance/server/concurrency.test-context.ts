import type { OrgContext } from "@/core/context";

type ProjectContext = Awaited<
  ReturnType<typeof import("@/core/context").requireProjectContext>
>;
const state = globalThis as typeof globalThis & {
  __attendanceConcurrencyContext?: ProjectContext;
};

export async function requireProjectContext() {
  if (!state.__attendanceConcurrencyContext)
    throw new Error("Attendance concurrency context is not configured.");
  return state.__attendanceConcurrencyContext;
}

export function assertPermission(ctx: OrgContext, permission: string) {
  if (!ctx.isAdmin && !ctx.permissions.has(permission))
    throw new Error("Attendance concurrency test context lacks permission.");
}
