import { masterData } from "../../server/queries";
import { MasterFormPage } from "../components/master-pages";
import { TaxGroupForm } from "../components/tax-forms";

export async function TaxGroupNewView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <MasterFormPage
      backHref={`/${org}/masters/tax?tab=groups`}
      backLabel="All tax groups"
      title="New tax group"
      description="Combine tax components to apply on items and documents."
      cardTitle="Tax group details"
    >
      <TaxGroupForm org={org} data={data} />
    </MasterFormPage>
  );
}
