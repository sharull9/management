import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import type { ListParams } from "@/core/pagination";
import { PaymentsList } from "@/modules/payment/ui/views/payments-list-view";

type Props = {
  params: Promise<{ org: string }>;
  searchParams: Promise<ListParams>;
};
async function Content({ params, searchParams }: Props) {
  const { org } = await params;
  const search = await searchParams;
  return (
    <PaymentsList
      org={org}
      projectId={
        Array.isArray(search.projectId) ? search.projectId[0] : search.projectId
      }
      params={search}
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
