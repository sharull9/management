import { PageHeading } from "@/components/shared/page-heading";
import { masterData } from "../../server/queries";
import { CategoryMasters } from "../components/category-level-forms";

export async function CategoriesView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Item categories"
        description="Shared across organizations in this tenant."
      />
      <CategoryMasters org={org} data={data} />
    </>
  );
}
