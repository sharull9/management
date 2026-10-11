import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { CategoryEditView } from "@/modules/masters/ui/views/category-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; categoryId: string }>;
}) {
  const { org, categoryId } = await params;
  return <CategoryEditView org={org} categoryId={categoryId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
