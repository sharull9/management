import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { StagesView } from "@/modules/project-stage/ui/views/stages-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const resolved = await params;
  return <StagesView {...resolved} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
