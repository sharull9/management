import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { TaskDetailView } from "@/modules/project-task/ui/views/task-detail-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; projectId: string; taskId: string }>;
}) {
  const resolved = await params;
  return <TaskDetailView {...resolved} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
