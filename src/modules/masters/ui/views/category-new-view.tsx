import { masterData } from "../../server/queries";
import { CategoryForm } from "../components/category-forms";
import { MasterFormPage } from "../components/master-pages";

export async function CategoryNewView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <MasterFormPage
      backHref={`/${org}/masters/categories`}
      backLabel="All categories"
      title="New category"
      description="Add a category, optionally under a parent."
      cardTitle="Category details"
    >
      <CategoryForm org={org} data={data} />
    </MasterFormPage>
  );
}
