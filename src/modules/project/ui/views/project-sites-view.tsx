import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateSheet, SideSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
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
      <SectionHeader
        title="Sites"
        description="Physical locations where work on this project happens."
        actions={
          manage && (
            <CreateSheet label="New site">
              <SiteForm
                org={org}
                projectId={projectId}
                countries={countriesOptions}
                states={statesOptions}
                cities={citiesOptions}
              />
            </CreateSheet>
          )
        }
      />
      <ItemGroup className="gap-2">
        {sites.map((s) => (
          <Item key={s.id} variant="outline" className="bg-card">
            <ItemMedia className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <MapPin className="size-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{s.name}</ItemTitle>
              <ItemDescription>
                {[
                  s.address,
                  s.city?.name,
                  s.state?.name,
                  s.country?.name,
                  s.pincode,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </ItemDescription>
            </ItemContent>
            {manage && (
              <ItemActions>
                <SideSheet
                  title={`Edit ${s.name}`}
                  trigger="Edit"
                  triggerVariant="outline"
                  triggerSize="sm"
                >
                  <div className="space-y-6">
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
                    <Separator />
                    <DeleteSiteForm org={org} projectId={projectId} id={s.id} />
                  </div>
                </SideSheet>
              </ItemActions>
            )}
          </Item>
        ))}
      </ItemGroup>
      {!sites.length && <EmptyState title="No sites yet." />}
    </>
  );
}
