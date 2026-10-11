import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";

import { DeleteSiteForm, SiteForm } from "../components/site-form";
export async function ProjectSitesView({
  org,
  projectId,
}: {
  org: string;
  projectId: string;
}) {
  const ctx = await requireProjectContext(org, projectId);
  const manage = ctx.isAdmin || ctx.permissions.has("project.edit");
  const [sites, countries, states, cities] = await Promise.all([
    db.projectSite.findMany({
      where: { projectId },
      include: { country: true, state: true, city: true },
      orderBy: { name: "asc" },
    }),
    db.country.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    db.state.findMany({
      select: { id: true, name: true, countryId: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    db.city.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true, stateId: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);

  const countriesOptions = [
    ...new Map(
      [
        ...countries,
        ...sites.flatMap((site) => (site.country ? [site.country] : [])),
      ].map((country) => [country.id, { id: country.id, name: country.name }]),
    ).values(),
  ];
  const statesOptions = [
    ...new Map(
      [
        ...states,
        ...sites.flatMap((site) => (site.state ? [site.state] : [])),
      ].map((state) => [
        state.id,
        {
          id: state.id,
          name: state.name,
          countryId: state.countryId,
        },
      ]),
    ).values(),
  ];
  const citiesOptions = [
    ...new Map(
      [
        ...cities,
        ...sites.flatMap((site) => (site.city ? [site.city] : [])),
      ].map((city) => [
        city.id,
        {
          id: city.id,
          name: city.name,
          stateId: city.stateId,
        },
      ]),
    ).values(),
  ];
  return (
    <>
      <h2 className="text-lg font-medium">Sites</h2>
      <ItemGroup>
        {sites.map((s) => (
          <Item key={s.id} variant="outline">
            <ItemContent>
              <ItemTitle>{s.name}</ItemTitle>
              <p className="mb-4 text-sm">
                {s.address} · {s.city?.name} · {s.state?.name} ·{" "}
                {s.country?.name} · {s.pincode}
              </p>
              {manage && (
                <details>
                  <summary className="cursor-pointer">Edit site</summary>
                  <div className="space-y-4 pt-4">
                    <SiteForm
                      org={org}
                      projectId={projectId}
                      site={{
                        id: s.id,
                        name: s.name,
                        address: s.address,
                        pincode: s.pincode,
                        countryId: s.countryId,
                        stateId: s.stateId,
                        cityId: s.cityId,
                        latitude: s.latitude?.toString() ?? null,
                        longitude: s.longitude?.toString() ?? null,
                      }}
                      countries={countriesOptions}
                      states={statesOptions}
                      cities={citiesOptions}
                    />
                    <DeleteSiteForm org={org} projectId={projectId} id={s.id} />
                  </div>
                </details>
              )}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {!sites.length && <EmptyState title="No sites yet." />}
      {manage && (
        <FormCard title="Create site">
          <SiteForm
            org={org}
            projectId={projectId}
            countries={countriesOptions}
            states={statesOptions}
            cities={citiesOptions}
          />
        </FormCard>
      )}
    </>
  );
}
