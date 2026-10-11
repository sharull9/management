import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { CityEditView } from "@/modules/masters/ui/views/city-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; cityId: string }>;
}) {
  const { org, cityId } = await params;
  return <CityEditView org={org} cityId={cityId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
