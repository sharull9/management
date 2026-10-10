import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { requireProjectContext } from "@/core/context";
import { ProjectOverviewView } from "@/modules/project/ui/views/project-overview-view";
import { ProjectCostRecognitionForm } from "@/modules/project-cost/ui/views/project-cost-recognition-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const resolved = await params;
  const ctx = await requireProjectContext(resolved.org, resolved.projectId);
  return (
    <ProjectOverviewView
      {...resolved}
      ctx={ctx}
      costRecognitionForm={
        <ProjectCostRecognitionForm org={resolved.org} project={ctx.project} />
      }
    />
  );
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
