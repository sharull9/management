export function hasPrivilegedMemberRole(role: string, roleId: string | null) {
  return role !== "member" || roleId !== null;
}
