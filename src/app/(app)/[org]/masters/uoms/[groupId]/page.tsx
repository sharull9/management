import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { UomGroupEditView } from "@/modules/masters/ui/views/uom-group-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; groupId: string }>;
}) {
  const { org, groupId } = await params;
  return <UomGroupEditView org={org} groupId={groupId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
