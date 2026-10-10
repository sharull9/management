import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { DashboardView } from "@/modules/dashboard/ui/views/dashboard-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const resolved = await params;
  return <DashboardView {...resolved} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
