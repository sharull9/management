import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { TaxComponentEditView } from "@/modules/masters/ui/views/tax-component-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; componentId: string }>;
}) {
  const { org, componentId } = await params;
  return <TaxComponentEditView org={org} componentId={componentId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
