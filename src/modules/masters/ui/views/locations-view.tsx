import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { CitiesTable } from "../components/cities-table";
import { CityForm } from "../components/city-form";

export async function LocationsView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "masters.manage");
  const [countries, states, cities] = await Promise.all([
    db.country.findMany({
      include: { states: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.state.findMany({ include: { country: true }, orderBy: { name: "asc" } }),
    db.city.findMany({
      where: { tenantId: ctx.tenant.id },
      include: { state: { include: { country: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeading
        title="Locations"
        description="Countries and states are global reference data. Cities are shared only within your tenant."
      />
      <FormCard title="Tenant cities">
        <CitiesTable
          org={org}
          cities={cities.map(({ id, name, stateId, state }) => ({
            id,
            name,
            stateId,
            state: { name: state.name, country: { code: state.country.code } },
          }))}
          states={states.map(({ id, name, country }) => ({
            id,
            name,
            country: { code: country.code },
          }))}
        />
      </FormCard>
      <FormCard title="Add city">
        <CityForm
          org={org}
          states={states.map((s) => ({
            value: s.id,
            label: `${s.country.code} · ${s.name}`,
          }))}
        />
      </FormCard>
      <FormCard title="Countries and states (read-only)">
        <div className="grid gap-4 sm:grid-cols-2">
          {countries.map((country) => (
            <Item key={country.id} variant="outline">
              <ItemContent>
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    {country.name} ({country.code}) · {country.states.length}{" "}
                    states
                  </summary>
                  <ItemGroup className="mt-3">
                    {country.states.map((state) => (
                      <Item key={state.id} variant="outline">
                        <ItemContent>
                          <ItemTitle>
                            {state.name} ({state.code})
                          </ItemTitle>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                  {!country.states.length && (
                    <EmptyState title="No states seeded." />
                  )}
                </details>
              </ItemContent>
            </Item>
          ))}
        </div>
      </FormCard>
    </>
  );
}
