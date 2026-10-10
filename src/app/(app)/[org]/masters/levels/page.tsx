import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { LevelsView } from "@/modules/masters/ui/views/levels-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <LevelsView org={org} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
