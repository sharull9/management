import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ExchangeRatesView } from "@/modules/currency/ui/views/exchange-rates-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ currency?: string; from?: string; to?: string }>;
}) {
  const { org } = await params;
  const filters = await searchParams;
  return <ExchangeRatesView org={org} searchParams={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
