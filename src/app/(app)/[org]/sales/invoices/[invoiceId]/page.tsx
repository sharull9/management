import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { InvoiceDetail } from "@/modules/sales-invoice/ui/views/invoices-detail-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; invoiceId: string }>;
}) {
  const { org, invoiceId } = await params;
  return <InvoiceDetail org={org} invoiceId={invoiceId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
