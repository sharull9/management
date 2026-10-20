import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ProcurementList } from "@/modules/procurement/ui/views/orders-list-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org } = await params;
  const filters = await searchParams;
  return (
    <ProcurementList
      org={org}
      kind="orders"
      projectId={
        Array.isArray(filters.projectId)
          ? filters.projectId[0]
          : filters.projectId
      }
      searchParams={filters}
    />
  );
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
