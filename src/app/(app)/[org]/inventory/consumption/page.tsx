import { Suspense } from "react";
import { InventoryPage } from "@/components/inventory-pages";
import Loading from "@/components/shared/page-loading";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId?: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const p = await params;
  const s = await searchParams;
  return (
    <InventoryPage
      org={p.org}
      kind="consumption"
      projectId={p.projectId ?? s.projectId}
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
