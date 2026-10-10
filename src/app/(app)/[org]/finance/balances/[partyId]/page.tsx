import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { StatementPage } from "@/components/finance/pages";

type Props = {
  params: Promise<{ org: string; partyId: string }>;
  searchParams: Promise<{
    projectId?: string;
    requestId?: string;
    type?: string;
    currency?: string;
  }>;
};
async function Content({ params, searchParams }: Props) {
  const { org, partyId } = await params;
  const search = await searchParams;
  return (
    <StatementPage
      org={org}
      partyId={partyId}
      currency={search.currency}
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
