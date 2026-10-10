import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ProcurementDetail } from "@/modules/procurement/ui/views/transfers-detail-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; documentId: string }>;
}) {
  const { org, documentId } = await params;
  return (
    <ProcurementDetail org={org} documentId={documentId} kind="transfers" />
  );
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
