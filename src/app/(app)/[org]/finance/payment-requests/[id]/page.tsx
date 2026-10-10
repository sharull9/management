import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { RequestDetail } from "@/modules/payment/ui/views/payment-requests-detail-view";

type Props = {
  params: Promise<{ org: string; id: string }>;
  searchParams: Promise<{
    projectId?: string;
    requestId?: string;
    type?: string;
    currency?: string;
  }>;
};
async function Content({ params }: Props) {
  const { org, id } = await params;
  return <RequestDetail org={org} id={id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
