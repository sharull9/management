import { masterData } from "../../server/queries";
import { ItemForm } from "../components/item-form";
import { MasterFormPage } from "../components/master-pages";

export async function ItemNewView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <MasterFormPage
      backHref={`/${org}/masters/items`}
      backLabel="All items"
      title="New item"
      description="Define the item, its units and variant levels."
      cardTitle="Item details"
    >
      <ItemForm org={org} data={data} />
    </MasterFormPage>
  );
}
