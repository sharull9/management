import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { BalancesPage } from "@/components/finance/pages";

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
    <BalancesPage org={org} projectId={search.projectId} type={search.type} />
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
