import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { InventoryView } from "@/modules/procurement/ui/views/stock-list-view";

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
    <InventoryView
      org={p.org}
      kind="stock"
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
