import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { LocationsView } from "@/modules/masters/ui/views/locations-view";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <LocationsView org={org} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
