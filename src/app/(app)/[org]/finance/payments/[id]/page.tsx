import { Suspense } from "react";
import { PaymentDetail } from "@/components/finance/pages";
import Loading from "@/components/shared/page-loading";

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
  return <PaymentDetail org={org} id={id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
