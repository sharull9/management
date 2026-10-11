import { notFound } from "next/navigation";
import { masterData } from "../../server/queries";
import { MasterFormPage } from "../components/master-pages";
import { TaxGroupForm } from "../components/tax-forms";

export async function TaxGroupEditView({
  org,
  groupId,
}: {
  org: string;
  groupId: string;
}) {
  const data = await masterData(org);
  const taxGroup = data.taxGroups.find((g) => g.id === groupId);
  if (!taxGroup) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/tax?tab=groups`}
      backLabel="All tax groups"
      title={taxGroup.name}
      description={`${taxGroup.components.length} components`}
      cardTitle="Tax group details"
    >
      <TaxGroupForm org={org} data={data} taxGroup={taxGroup} />
    </MasterFormPage>
  );
}
