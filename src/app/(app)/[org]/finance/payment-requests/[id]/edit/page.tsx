import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { RequestEditView } from "@/modules/payment/ui/views/request-edit-view";

type Props = { params: Promise<{ org: string; id: string }> };
async function Content({ params }: Props) {
  const { org, id } = await params;
  return <RequestEditView org={org} id={id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
