import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { PaymentsList } from "@/modules/payment/ui/views/payments-list-view";

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
  return <PaymentsList org={org} projectId={search.projectId} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
