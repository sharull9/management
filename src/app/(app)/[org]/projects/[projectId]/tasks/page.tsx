import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { TasksView } from "@/modules/project-task/ui/views/tasks-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<{ status?: string; stageId?: string; search?: string }>;
}) {
  const resolved = await params;
  const filters = await searchParams;
  return <TasksView {...resolved} searchParams={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
