import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import type { ListParams } from "@/core/pagination";
import { PaymentsNew } from "@/modules/payment/ui/views/payments-new-view";

type Props = {
  params: Promise<{ org: string }>;
  searchParams: Promise<ListParams>;
};
async function Content({ params, searchParams }: Props) {
  const { org } = await params;
  const search = await searchParams;
  return (
    <PaymentsNew
      org={org}
      requestId={
        Array.isArray(search.requestId) ? search.requestId[0] : search.requestId
      }
      projectId={
        Array.isArray(search.projectId) ? search.projectId[0] : search.projectId
      }
    />
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
