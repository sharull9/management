import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { UomsView } from "@/modules/masters/ui/views/uoms-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <UomsView org={org} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
