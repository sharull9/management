import { UserFacingError } from "@/core/errors";

const state = globalThis as typeof globalThis & {
  __paymentReadTestContext?: Record<string, unknown>;
};

export function setPaymentReadTestContext(ctx: Record<string, unknown>) {
  state.__paymentReadTestContext = ctx;
}

export async function requireOrgContext() {
  if (!state.__paymentReadTestContext)
    throw new Error("Payment read test context was not initialized.");
  return state.__paymentReadTestContext;
}

export async function requireProjectContext() {
  return requireOrgContext();
}

export function assertPermission(
  ctx: { isAdmin: boolean; permissions: Set<string> },
  permission: string,
) {
  if (!ctx.isAdmin && !ctx.permissions.has(permission))
    throw new UserFacingError("Permission denied in payment read test.");
}

export function projectAccessWhere() {
  return {};
}
