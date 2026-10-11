import { notFound } from "next/navigation";
import { masterData } from "../../server/queries";
import { MasterFormPage } from "../components/master-pages";
import { TaxComponentForm } from "../components/tax-forms";

export async function TaxComponentEditView({
  org,
  componentId,
}: {
  org: string;
  componentId: string;
}) {
  const data = await masterData(org);
  const taxComponent = data.components.find((c) => c.id === componentId);
  if (!taxComponent) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/tax?tab=components`}
      backLabel="All tax components"
      title={taxComponent.name}
      description={`Code ${taxComponent.code}`}
      cardTitle="Tax component details"
    >
      <TaxComponentForm org={org} taxComponent={taxComponent} />
    </MasterFormPage>
  );
}
