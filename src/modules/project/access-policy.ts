type AccessPolicyContext = {
  isAdmin: boolean;
  permissions: ReadonlySet<string>;
};

export function canManageProjectApprovers(ctx: AccessPolicyContext) {
  return (
    ctx.isAdmin ||
    ctx.permissions.has("project.manage") ||
    ctx.permissions.has("project.settings.manage")
  );
}

export function canViewCompensation(ctx: AccessPolicyContext) {
  return (
    ctx.isAdmin ||
    ctx.permissions.has("cost.view") ||
    ctx.permissions.has("workforce.manage")
  );
}
