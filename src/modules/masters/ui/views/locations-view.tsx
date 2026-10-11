import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { CitiesTable } from "../components/cities-table";
import { LocationReference } from "../components/location-reference";
import { MasterListPage } from "../components/master-pages";

export async function LocationsView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "masters.manage");
  const [countries, cities] = await Promise.all([
    db.country.findMany({
      include: { states: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.city.findMany({
      where: { tenantId: ctx.tenant.id },
      include: { state: { include: { country: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <MasterListPage
        title="Locations"
        description="Countries and states are global reference data. Cities are shared only within your tenant."
        newHref={`/${org}/masters/locations/new`}
        newLabel="New city"
      >
        <CitiesTable
          org={org}
          cities={cities.map(({ id, name, state }) => ({
            id,
            name,
            state: state.name,
            country: state.country.code,
          }))}
        />
      </MasterListPage>
      <LocationReference countries={countries} />
    </div>
  );
}
