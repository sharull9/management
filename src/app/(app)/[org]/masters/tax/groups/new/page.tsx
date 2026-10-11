import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { TaxGroupNewView } from "@/modules/masters/ui/views/tax-group-new-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <TaxGroupNewView org={org} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
