import { ActionForm } from "@/components/shared/action-form";
import { FormCard } from "@/components/shared/form-card";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { siteAction } from "../../server/site-actions";
import { SiteForm } from "../components/site-form";
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
    }),
    db.state.findMany({
      select: { id: true, name: true, countryId: true },
      orderBy: { name: "asc" },
    }),
    db.city.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true, stateId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const action = siteAction.bind(null, org, projectId);
  return (
    <>
      <h2 className="text-lg font-medium">Sites</h2>
      {sites.map((s) => (
        <FormCard key={s.id} title={s.name}>
          <p className="mb-4 text-sm">
            {s.address} · {s.city?.name} · {s.state?.name} · {s.country?.name} ·{" "}
            {s.pincode}
          </p>
          {manage && (
            <details>
              <summary className="cursor-pointer">Edit site</summary>
              <div className="space-y-4 pt-4">
                <SiteForm
                  action={action}
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
                  countries={countries}
                  states={states}
                  cities={cities}
                />
                <ActionForm action={action} submit="Delete site" destructive>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="operation" value="DELETE" />
                </ActionForm>
              </div>
            </details>
          )}
        </FormCard>
      ))}
      {!sites.length && (
        <p className="text-sm text-muted-foreground">No sites yet.</p>
      )}
      {manage && (
        <FormCard title="Create site">
          <SiteForm
            action={action}
            countries={countries}
            states={states}
            cities={cities}
          />
        </FormCard>
      )}
    </>
  );
}
