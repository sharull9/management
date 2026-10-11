import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { saveCityAction } from "../../server/location-actions";
import { CitiesTable } from "../components/cities-table";

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
        <ActionForm action={saveCityAction.bind(null, org)} submit="Add city">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City name" name="name" required />
            <SelectField label="State" name="stateId" required defaultValue="">
              <option value="">Choose state</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.country.code} · {s.name}
                </option>
              ))}
            </SelectField>
          </div>
        </ActionForm>
      </FormCard>
      <FormCard title="Countries and states (read-only)">
        <div className="grid gap-4 sm:grid-cols-2">
          {countries.map((country) => (
            <details key={country.id} className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {country.name} ({country.code}) · {country.states.length} states
              </summary>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {country.states.map((state) => (
                  <li key={state.id}>
                    {state.name} ({state.code})
                  </li>
                ))}
              </ul>
              {!country.states.length && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No states seeded.
                </p>
              )}
            </details>
          ))}
        </div>
      </FormCard>
    </>
  );
}
