import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import type { ListParams } from "@/core/pagination";
import { AssetsView } from "@/modules/assets/ui/views/assets-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<ListParams>;
}) {
  const [route, filters] = await Promise.all([params, searchParams]);
  return <AssetsView org={route.org} params={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
