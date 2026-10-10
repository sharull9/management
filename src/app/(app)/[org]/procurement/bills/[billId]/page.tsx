import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { BillDetail } from "@/components/bills/pages";

async function Content({
  params,
}: {
  params: Promise<{ org: string; billId: string }>;
}) {
  const { org, billId } = await params;
  return <BillDetail org={org} billId={billId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
