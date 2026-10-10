import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { MembersView } from "@/modules/organization/ui/views/members-view";

async function MembersPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <MembersView org={org} />;
}
export default function Page(props: Parameters<typeof MembersPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <MembersPage {...props} />
    </Suspense>
  );
}
