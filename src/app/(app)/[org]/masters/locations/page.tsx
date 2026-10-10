import { Suspense } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import Loading from "@/components/shared/page-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { deleteCityAction, saveCityAction } from "@/server/actions";

async function LocationsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City</TableHead>
              <TableHead>State / country</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.map((city) => (
              <TableRow key={city.id}>
                <TableCell>{city.name}</TableCell>
                <TableCell>
                  {city.state.name} · {city.state.country.code}
                </TableCell>
                <TableCell>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Edit city
                    </summary>
                    <div className="min-w-56 space-y-4 pt-4">
                      <ActionForm action={saveCityAction.bind(null, org)}>
                        <input type="hidden" name="id" value={city.id} />
                        <Field
                          label="City name"
                          name="name"
                          defaultValue={city.name}
                          required
                        />
                        <SelectField
                          label="State"
                          name="stateId"
                          defaultValue={city.stateId}
                        >
                          {states.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.country.code} · {s.name}
                            </option>
                          ))}
                        </SelectField>
                      </ActionForm>
                      <ActionForm
                        action={deleteCityAction.bind(null, org)}
                        submit="Delete city"
                        destructive
                      >
                        <input type="hidden" name="id" value={city.id} />
                      </ActionForm>
                    </div>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!cities.length && (
          <p className="py-4 text-sm text-muted-foreground">No cities yet.</p>
        )}
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

export default function Page(props: Parameters<typeof LocationsPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <LocationsPage {...props} />
    </Suspense>
  );
}
