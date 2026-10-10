import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { FinanceList } from "@/modules/payment/ui/views/payment-requests-list-view";

type Props = {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    projectId?: string;
    requestId?: string;
    type?: string;
    currency?: string;
  }>;
};
async function Content({ params, searchParams }: Props) {
  const { org } = await params;
  const search = await searchParams;
  return (
    <FinanceList
      org={org}
      kind="payment-requests"
      projectId={search.projectId}
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
