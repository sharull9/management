import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { requireSuperAdmin } from "@/core/context";
import { db } from "@/core/db";
import { signOutAction } from "@/modules/organization-auth/server/actions";
import { CreateTenantForm } from "../components/tenant-forms";
import { TenantsTable } from "../components/tenants-table";
export async function AdminView() {
  await requireSuperAdmin();
  const tenants = await db.tenant.findMany({
    include: {
      organizations: true,
      members: {
        where: { role: "OWNER" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-10">
      <PageHeading
        title="Platform administration"
        description="Create tenant accounts and control access to the platform."
      />
      <div className="flex gap-4">
        <Link href="/" className="text-sm underline">
          Organization picker
        </Link>
        <ActionForm action={signOutAction} submit="Sign out" />
      </div>
      <FormCard title="Tenants">
        <TenantsTable
          data={tenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            owners: tenant.members.map((member) => ({
              id: member.id,
              ...member.user,
            })),
            organizations: tenant.organizations.map((org) => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
              baseCurrency: org.baseCurrency,
            })),
          }))}
        />
      </FormCard>
      <FormCard title="Create tenant">
        <CreateTenantForm />
      </FormCard>
    </main>
  );
}
