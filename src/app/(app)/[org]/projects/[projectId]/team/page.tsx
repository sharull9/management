import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { TeamView } from "@/modules/project-team/ui/views/team-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const resolved = await params;
  return <TeamView {...resolved} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
