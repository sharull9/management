import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ItemEditView } from "@/modules/masters/ui/views/item-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; itemId: string }>;
}) {
  const { org, itemId } = await params;
  return <ItemEditView org={org} itemId={itemId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
