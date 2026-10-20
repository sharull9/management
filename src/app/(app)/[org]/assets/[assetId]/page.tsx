import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import type { ListParams } from "@/core/pagination";
import { AssetDetailView } from "@/modules/assets/ui/views/asset-detail-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; assetId: string }>;
  searchParams: Promise<ListParams>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  return (
    <AssetDetailView
      org={route.org}
      assetId={route.assetId}
      projectId={
        Array.isArray(query.projectId) ? query.projectId[0] : query.projectId
      }
      params={query}
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
