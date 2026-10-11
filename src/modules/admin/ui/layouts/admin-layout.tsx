import { requireSuperAdmin } from "@/core/context";
import { db } from "@/core/db";
import { AdminShell } from "../components/admin-shell";
export async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  const memberships = await db.tenantMember.count({
    where: { userId: user.id, tenant: { status: "ACTIVE" } },
  });
  return (
    <AdminShell
      user={{ name: user.name, email: user.email }}
      hasWorkspaces={memberships > 0}
    >
      {children}
    </AdminShell>
  );
}
