import { AppShell } from "@/components/shared/app-shell";
import { listAccessibleOrgs, requireOrgContext } from "@/core/context";
export const instant = false;
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireOrgContext(slug);
  const organizations = await listAccessibleOrgs(ctx.user.id);
  return (
    <AppShell
      org={{ name: ctx.org.name, slug, tenantName: ctx.tenant.name }}
      organizations={organizations.map(({ name, slug }) => ({ name, slug }))}
      user={{ name: ctx.user.name, email: ctx.user.email }}
    >
      {children}
    </AppShell>
  );
}
