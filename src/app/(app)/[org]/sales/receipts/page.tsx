import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import type { ListParams } from "@/core/pagination";
import { FinanceList } from "@/modules/payment/ui/views/receipts-list-view";

type Props = {
  params: Promise<{ org: string }>;
  searchParams: Promise<ListParams>;
};
async function Content({ params, searchParams }: Props) {
  const { org } = await params;
  const search = await searchParams;
  return (
    <FinanceList
      org={org}
      kind="receipts"
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
