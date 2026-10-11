import { PageHeading } from "@/components/shared/page-heading";
import { masterData } from "../../server/queries";
import { ItemMasters } from "../components/item-forms";

export async function ItemsView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Items and variants"
        description="Shared across organizations in this tenant."
      />
      <ItemMasters org={org} data={data} />
    </>
  );
}
