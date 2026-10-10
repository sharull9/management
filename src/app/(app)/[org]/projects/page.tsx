import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ProjectsView } from "@/modules/project/ui/views/projects-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const resolved = await params;
  const filters = await searchParams;
  return <ProjectsView {...resolved} searchParams={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
