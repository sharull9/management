import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { CurrenciesView } from "@/modules/currency/ui/views/currencies-view";

async function CurrenciesViewPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return <CurrenciesView org={org} />;
}
export default function Page(props: Parameters<typeof CurrenciesViewPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <CurrenciesViewPage {...props} />
    </Suspense>
  );
}
