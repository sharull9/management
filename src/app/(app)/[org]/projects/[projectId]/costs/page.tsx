import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { CostsView } from "@/modules/project-cost/ui/views/costs-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<{
    costType?: string;
    stageId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolved = await params;
  const filters = await searchParams;
  return <CostsView {...resolved} searchParams={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
