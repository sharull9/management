import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { CategoriesView } from "@/modules/masters/ui/views/categories-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <CategoriesView org={org} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
