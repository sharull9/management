import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { BillEdit } from "@/modules/vendor-bill/ui/views/bills-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; billId: string }>;
}) {
  const { org, billId } = await params;
  return <BillEdit org={org} billId={billId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
