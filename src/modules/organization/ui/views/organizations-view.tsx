import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertTenantAdmin, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { OrganizationForm } from "../components/organization-form";

export async function OrganizationsView({ org: slug }: { org: string }) {
  const ctx = await requireOrgContext(slug);
  assertTenantAdmin(ctx);
  const [organizations, countries, states, cities] = await Promise.all([
    db.organization.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
    }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.state.findMany({ orderBy: { name: "asc" } }),
    db.city.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeading
        title="Organizations"
        description={`Manage companies within ${ctx.tenant.name}. Changes to shared masters apply to every organization in this tenant.`}
      />
      <div className="space-y-4">
        {organizations.map((org) => (
          <FormCard key={org.id} title={org.name}>
            <details>
              <summary className="cursor-pointer text-sm">
                /{org.slug} · {org.baseCurrency} · Edit organization
              </summary>
              <div className="pt-6">
                <OrganizationForm
                  tenantId={ctx.tenant.id}
                  orgSlug={slug}
                  org={org}
                  countries={countries}
                  states={states}
                  cities={cities}
                />
              </div>
            </details>
          </FormCard>
        ))}
      </div>
      <FormCard title="Create organization">
        <OrganizationForm
          tenantId={ctx.tenant.id}
          orgSlug={slug}
          countries={countries}
          states={states}
          cities={cities}
        />
      </FormCard>
    </>
  );
}
