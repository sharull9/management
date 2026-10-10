import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { LocationsView } from "@/modules/masters/ui/views/locations-view";

async function LocationsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <LocationsView org={org} />;
}
export default function Page(props: Parameters<typeof LocationsPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <LocationsPage {...props} />
    </Suspense>
  );
}
