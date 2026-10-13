import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ExchangeRatesView } from "@/modules/currency/ui/views/exchange-rates-view";

async function ExchangeRatesViewPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return <ExchangeRatesView org={org} />;
}
export default function Page(
  props: Parameters<typeof ExchangeRatesViewPage>[0],
) {
  return (
    <Suspense fallback={<Loading />}>
      <ExchangeRatesViewPage {...props} />
    </Suspense>
  );
}
