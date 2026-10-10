import { PageHeading } from "@/components/shared/page-heading";
import { masterData } from "../../server/queries";
import { TaxMasters } from "../components/master-forms";

export async function TaxView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Tax components and groups"
        description="Shared across organizations in this tenant."
      />
      <TaxMasters org={org} data={data} />
    </>
  );
}
