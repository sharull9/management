import { masterData } from "../../server/queries";
import { MasterListPage } from "../components/master-pages";
import { PartiesTable } from "../components/parties-table";

export async function PartiesView({ org }: { org: string }) {
  const data = await masterData(org);
  const states = new Map(data.states.map((s) => [s.id, s.name]));
  const cities = new Map(data.cities.map((c) => [c.id, c.name]));
  return (
    <MasterListPage
      title="Parties"
      description="Vendors and customers, shared across organizations in this tenant."
      newHref={`/${org}/masters/parties/new`}
      newLabel="New party"
    >
      <PartiesTable
        org={org}
        parties={data.parties.map((party) => {
          const address =
            party.addresses.find((a) => a.isDefault) ?? party.addresses[0];
          return {
            id: party.id,
            code: party.code,
            name: party.displayName,
            isVendor: party.isVendor,
            isCustomer: party.isCustomer,
            defaultCurrency: party.defaultCurrency ?? "",
            taxId: party.taxIdentifiers[0]?.value ?? "",
            location: [
              address?.cityId && cities.get(address.cityId),
              address?.stateId && states.get(address.stateId),
            ]
              .filter(Boolean)
              .join(", "),
            contact: [party.phone, party.email].filter(Boolean).join(" · "),
          };
        })}
      />
    </MasterListPage>
  );
}
