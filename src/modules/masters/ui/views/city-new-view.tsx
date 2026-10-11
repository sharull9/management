import { stateOptions } from "../../server/location-queries";
import { CityForm } from "../components/city-form";
import { MasterFormPage } from "../components/master-pages";

export async function CityNewView({ org }: { org: string }) {
  const states = await stateOptions(org);
  return (
    <MasterFormPage
      backHref={`/${org}/masters/locations`}
      backLabel="All locations"
      title="New city"
      description="Add a city to your tenant."
      cardTitle="City details"
    >
      <CityForm org={org} states={states} />
    </MasterFormPage>
  );
}
