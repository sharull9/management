import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { WorkforceView } from "@/modules/workforce/ui/views/workforce-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    search?: string;
    workerId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolved = await params;
  const filters = await searchParams;
  return <WorkforceView {...resolved} searchParams={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
