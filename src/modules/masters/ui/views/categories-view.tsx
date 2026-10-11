import { masterData } from "../../server/queries";
import { categoryPath } from "../category-path";
import { CategoriesTable } from "../components/categories-table";
import { MasterListPage } from "../components/master-pages";

export async function CategoriesView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <MasterListPage
      title="Item categories"
      description="Shared across organizations in this tenant."
      newHref={`/${org}/masters/categories/new`}
      newLabel="New category"
    >
      <CategoriesTable
        org={org}
        categories={data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          parent: c.parentId ? categoryPath(data.categories, c.parentId) : "",
          items: data.items.filter((i) => i.categoryId === c.id).length,
        }))}
      />
    </MasterListPage>
  );
}
