import { PageHeading } from "@/components/shared/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { requireSuperAdmin } from "@/core/context";
import { listTenants } from "../../server/queries";
import { CreateTenantDialog } from "../components/tenant-forms";
import { TenantsTable } from "../components/tenants-table";
export async function TenantsView() {
  await requireSuperAdmin();
  const tenants = await listTenants();
  return (
    <>
      <PageHeading
        title="Tenants"
        description="Every customer account on the platform. Suspend a tenant to block its members without deleting data."
        actions={<CreateTenantDialog />}
      />
      <Card>
        <CardContent>
          <TenantsTable
            data={tenants.map((tenant) => ({
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
              createdAt: tenant.createdAt.toLocaleDateString("en-IN", {
                dateStyle: "medium",
              }),
              memberCount: tenant._count.members,
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
        </CardContent>
      </Card>
    </>
  );
}
