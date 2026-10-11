import { PageHeading } from "@/components/shared/page-heading";
import { masterData } from "../../server/queries";
import { UomMasters } from "../components/uom-forms";

export async function UomsView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="UOM groups and units"
        description="Shared across organizations in this tenant."
      />
      <UomMasters org={org} data={data} />
    </>
  );
}
