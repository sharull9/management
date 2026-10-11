import { notFound } from "next/navigation";
import { masterData } from "../../server/queries";
import { categoryPath } from "../category-path";
import { CategoryForm } from "../components/category-forms";
import { MasterFormPage } from "../components/master-pages";

export async function CategoryEditView({
  org,
  categoryId,
}: {
  org: string;
  categoryId: string;
}) {
  const data = await masterData(org);
  const category = data.categories.find((c) => c.id === categoryId);
  if (!category) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/categories`}
      backLabel="All categories"
      title={category.name}
      description={categoryPath(data.categories, category.id)}
      cardTitle="Category details"
    >
      <CategoryForm org={org} data={data} category={category} />
    </MasterFormPage>
  );
}
