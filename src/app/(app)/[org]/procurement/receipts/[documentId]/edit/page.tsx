import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ProcurementEdit } from "@/modules/procurement/ui/views/receipts-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; documentId: string }>;
}) {
  const { org, documentId } = await params;
  return <ProcurementEdit org={org} documentId={documentId} kind="receipts" />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
