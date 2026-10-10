import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { ProcurementDetail } from "@/components/procurement-pages";

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
