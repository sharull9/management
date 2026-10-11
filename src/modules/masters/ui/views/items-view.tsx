import { masterData } from "../../server/queries";
import { ItemsTable } from "../components/items-table";
import { MasterListPage } from "../components/master-pages";

export async function ItemsView({ org }: { org: string }) {
  const data = await masterData(org);
  const categories = new Map(data.categories.map((c) => [c.id, c.name]));
  return (
    <MasterListPage
      title="Items"
      description="Shared across organizations in this tenant."
      newHref={`/${org}/masters/items/new`}
      newLabel="New item"
    >
      <ItemsTable
        org={org}
        items={data.items.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          category: (item.categoryId && categories.get(item.categoryId)) || "",
          type: item.type,
          uom: item.stockUom.name,
          variants: item.variants.length,
          active: item.active,
        }))}
      />
    </MasterListPage>
  );
}
