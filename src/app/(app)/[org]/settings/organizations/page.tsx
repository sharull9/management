import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { OrganizationsView } from "@/modules/organization/ui/views/organizations-view";

async function OrganizationsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return <OrganizationsView org={org} />;
}
export default function Page(props: Parameters<typeof OrganizationsPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <OrganizationsPage {...props} />
    </Suspense>
  );
}
