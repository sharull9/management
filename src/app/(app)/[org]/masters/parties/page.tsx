import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { PartiesView } from "@/modules/masters/ui/views/parties-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <PartiesView org={org} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
