import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { InvoiceNew } from "@/modules/sales-invoice/ui/views/invoices-new-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { org } = await params;
  const { projectId } = await searchParams;
  return <InvoiceNew org={org} projectId={projectId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
