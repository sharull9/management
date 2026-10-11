import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { LevelEditView } from "@/modules/masters/ui/views/level-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; levelId: string }>;
}) {
  const { org, levelId } = await params;
  return <LevelEditView org={org} levelId={levelId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
