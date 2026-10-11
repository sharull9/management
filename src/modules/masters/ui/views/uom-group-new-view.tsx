import { MasterFormPage } from "../components/master-pages";
import { UomGroupForm } from "../components/uom-forms";

export function UomGroupNewView({ org }: { org: string }) {
  return (
    <MasterFormPage
      backHref={`/${org}/masters/uoms`}
      backLabel="All UOM groups"
      title="New UOM group"
      description="Create the group together with its base unit."
      cardTitle="Group details"
    >
      <UomGroupForm org={org} />
    </MasterFormPage>
  );
}
