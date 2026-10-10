import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ProjectBudgetView } from "@/modules/project/ui/views/project-budget-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const resolved = await params;
  return <ProjectBudgetView {...resolved} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
