import type { ReactNode } from "react";
import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { ProjectOverviewLayout } from "@/modules/project/ui/layouts/project-overview-layout";

async function Content({
  params,
  children,
}: {
  params: Promise<{ org: string; projectId: string }>;
  children: ReactNode;
}) {
  const resolved = await params;
  return (
    <ProjectOverviewLayout {...resolved}>{children}</ProjectOverviewLayout>
  );
}
export default function Layout(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
