import { MasterFormPage } from "../components/master-pages";
import { PartyForm } from "../components/party-forms";

export function PartyNewView({ org }: { org: string }) {
  return (
    <MasterFormPage
      backHref={`/${org}/masters/parties`}
      backLabel="All parties"
      title="New party"
      description="Add a vendor or customer. Addresses and contacts come after saving."
      cardTitle="Party details"
    >
      <PartyForm org={org} />
    </MasterFormPage>
  );
}
