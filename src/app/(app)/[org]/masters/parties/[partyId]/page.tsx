import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { PartyEditView } from "@/modules/masters/ui/views/party-edit-view";

async function Content({
  params,
}: {
  params: Promise<{ org: string; partyId: string }>;
}) {
  const { org, partyId } = await params;
  return <PartyEditView org={org} partyId={partyId} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
