import { Suspense } from "react";
import { FinanceNew } from "@/components/finance/pages";
import Loading from "@/components/shared/page-loading";

type Props = {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    projectId?: string;
    requestId?: string;
    type?: string;
    currency?: string;
  }>;
};
async function Content({ params }: Props) {
  const { org } = await params;
  return <FinanceNew org={org} kind="payment-requests" />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
