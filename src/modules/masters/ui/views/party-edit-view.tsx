import Link from "next/link";
import { notFound } from "next/navigation";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { masterData } from "../../server/queries";
import { MasterFormPage } from "../components/master-pages";
import { PartyForm } from "../components/party-forms";
import {
  PartyAddresses,
  PartyContacts,
  PartyTaxIdentifiers,
} from "../components/party-records";

export async function PartyEditView({
  org,
  partyId,
}: {
  org: string;
  partyId: string;
}) {
  const data = await masterData(org);
  const party = data.parties.find((p) => p.id === partyId);
  if (!party) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/parties`}
      backLabel="All parties"
      title={party.displayName}
      description={`Code ${party.code}`}
      cardTitle="Party details"
      actions={
        party.isCustomer ? (
          <Button asChild variant="outline">
            <Link href={`/${org}/projects`}>Customer projects</Link>
          </Button>
        ) : undefined
      }
      below={
        <UrlTabs
          tabs={[
            {
              value: "addresses",
              label: "Addresses",
              count: party.addresses.length,
              content: (
                <PartyAddresses
                  org={org}
                  locations={{
                    countries: data.countries,
                    states: data.states,
                    cities: data.cities,
                  }}
                  party={party}
                />
              ),
            },
            {
              value: "contacts",
              label: "Contacts",
              count: party.contacts.length,
              content: <PartyContacts org={org} party={party} />,
            },
            {
              value: "tax",
              label: "Tax IDs",
              count: party.taxIdentifiers.length,
              content: <PartyTaxIdentifiers org={org} party={party} />,
            },
          ]}
        />
      }
    >
      <PartyForm org={org} party={party} />
    </MasterFormPage>
  );
}
