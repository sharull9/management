import { notFound } from "next/navigation";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { stateOptions } from "../../server/location-queries";
import { CityForm } from "../components/city-form";
import { MasterFormPage } from "../components/master-pages";

export async function CityEditView({
  org,
  cityId,
}: {
  org: string;
  cityId: string;
}) {
  const ctx = await requireOrgContext(org);
  const [states, city] = await Promise.all([
    stateOptions(org),
    db.city.findFirst({ where: { id: cityId, tenantId: ctx.tenant.id } }),
  ]);
  if (!city) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/locations`}
      backLabel="All locations"
      title={city.name}
      description="Edit city details."
      cardTitle="City details"
    >
      <CityForm
        org={org}
        states={states}
        city={{ id: city.id, name: city.name, stateId: city.stateId }}
      />
    </MasterFormPage>
  );
}
