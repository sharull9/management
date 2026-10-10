import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { RolesView } from "@/modules/organization/ui/views/roles-view";

async function RolesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <RolesView org={org} />;
}
export default function Page(props: Parameters<typeof RolesPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <RolesPage {...props} />
    </Suspense>
  );
}
