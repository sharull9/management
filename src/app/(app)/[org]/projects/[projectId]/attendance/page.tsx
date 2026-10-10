import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { AttendanceView } from "@/modules/attendance/ui/views/attendance-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const resolved = await params;
  const filters = await searchParams;
  return <AttendanceView {...resolved} searchParams={filters} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
