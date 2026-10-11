import { PageHeading } from "@/components/shared/page-heading";
import { masterData } from "../../server/queries";
import { PartyMasters } from "../components/party-forms";

export async function PartiesView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Parties"
        description="Shared across organizations in this tenant."
      />
      <PartyMasters org={org} data={data} />
    </>
  );
}
